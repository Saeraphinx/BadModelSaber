import { afterAll, beforeAll, describe, expect, inject, test } from "vitest";
import { Alert, AlertType, Asset, assetApiV3Schema, DatabaseManager, Game, GameVersion, projectApiV3Schema, Status, Tags, User, versionApiV3Schema } from "../../src/shared/Database";
import { createDummyAsset, createDummyProject, createDummyUser, createDummyVersion, handleException } from "../testTools";
import { createCaller } from "../../src/api/routers";
import { SemVer } from "semver";
    

const createTestCaller = (userId?: number) => createCaller({
    userId,
    req: {} as any,
    res: {
        setHeader: () => undefined,
    } as any,
    db: {} as any,
});

describe(`v3`, () => {
    let databaseManager: DatabaseManager;
    let testAsset: Asset;
    let testUser: User;
    let caller = createTestCaller(123456);
    let anonymousCaller = createTestCaller();
    let modsGameVersion: GameVersion;
    let modsPublicProjectId: number;
    let modsVisibleVersionId: number;
    let modsHiddenProjectId: number;

    beforeAll(async () => {
        // @ts-ignore
        databaseManager = new DatabaseManager("test_trpc_v3", inject(`postgresUrl`));
        await databaseManager.init();
        await databaseManager.importFakeData();

        try {
            testUser = await createDummyUser(123456).save();
            testAsset = await createDummyAsset(123456, undefined, {
                status: Status.Verified
            }).save();

            await Game.create({
                name: `trpcmods`,
                displayName: `TRPC Mods`,
                default: false,
                webhookConfig: [],
            });

            modsGameVersion = await GameVersion.create({
                gameName: `trpcmods`,
                version: `1.37.0`,
                defaultVersion: true,
            });

            const hiddenAuthor = await createDummyUser(123457).save();

            const publicProject = await createDummyProject(`trpcmods`, undefined, {
                name: `TRPC Visible Mod`,
                nameId: `trpc-visible-mod`,
                status: Status.Verified,
                lastUpdatedById: testUser.id,
            }).save();
            await publicProject.$set(`authors`, [testUser]);

            const olderVersion = await createDummyVersion(publicProject.id, testUser.id, undefined, {
                semver: new SemVer(`1.0.0`),
                status: Status.Verified,
                lastUpdatedById: testUser.id,
            }).save();
            await olderVersion.$set(`supportedGameVersions`, [modsGameVersion]);

            const latestVersion = await createDummyVersion(publicProject.id, testUser.id, undefined, {
                semver: new SemVer(`2.0.0`),
                status: Status.Unverified,
                lastUpdatedById: testUser.id,
            }).save();
            await latestVersion.$set(`supportedGameVersions`, [modsGameVersion]);

            const hiddenProject = await createDummyProject(`trpcmods`, undefined, {
                name: `TRPC Hidden Mod`,
                nameId: `trpc-hidden-mod`,
                status: Status.Verified,
                lastUpdatedById: hiddenAuthor.id,
            }).save();
            await hiddenProject.$set(`authors`, [hiddenAuthor]);

            const hiddenVersion = await createDummyVersion(hiddenProject.id, hiddenAuthor.id, undefined, {
                semver: new SemVer(`3.0.0`),
                status: Status.Private,
                lastUpdatedById: hiddenAuthor.id,
            }).save();
            await hiddenVersion.$set(`supportedGameVersions`, [modsGameVersion]);

            modsPublicProjectId = publicProject.id;
            modsVisibleVersionId = latestVersion.id;
            modsHiddenProjectId = hiddenProject.id;
        } catch (error) {
            console.error(`Error setting up test data:`, error);
            handleException(error)();
        }
    });

    afterAll(async () => {
        await databaseManager.dropSchema().catch(console.error);
        await databaseManager.closeConnenction().catch(console.error);
    });

    describe(`getAsset`, () => {
        describe(`getAssets`, () => {
            test(`returns assets`, async () => {
                let response = await caller.v3.assets.getAssets({});
                expect(response.assets.length).toBeGreaterThan(0);
                expect(response.total).toEqual(response.assets.length);
                for (const asset of response.assets) {
                    expect(assetApiV3Schema.safeParse(asset).success).toBe(true);
                }
            });

            // test pagination
            test(`pagination works`, async () => {
                let response = await caller.v3.assets.getAssets({ limit: 1, page: 1 });
                expect(response.assets.length).toEqual(1);
                expect(response.total).toBeGreaterThan(1);
                for (const asset of response.assets) {
                    expect(assetApiV3Schema.safeParse(asset).success).toBe(true);
                }
                let response2 = await caller.v3.assets.getAssets({ limit: 1, page: 2 });
                expect(response2.assets.length).toEqual(1);
                expect(response2.total).toEqual(response.total);
                for (const asset of response2.assets) {
                    expect(assetApiV3Schema.safeParse(asset).success).toBe(true);
                }
                expect(response.assets[0].id).not.toEqual(response2.assets[0].id);
            });

            // test filtering by tags
            test(`filtering by tags works`, async () => {
                // add a tag to the test asset
                testAsset.tags = [Tags.Featured];
                await testAsset.save();
                let response = await caller.v3.assets.getAssets({ tags: [Tags.Featured] });
                expect(response.assets.length).toBeGreaterThan(0);
                let foundTestAsset = false;
                for (const asset of response.assets) {
                    expect(asset.tags).toContain(Tags.Featured);
                    if (asset.id === testAsset.id) {
                        foundTestAsset = true;
                    }
                }
                expect(foundTestAsset).toBe(true);
            });
        });

        test(`returns asset by id`, async () => {
            let response = await caller.v3.assets.getAssetById({ id: testAsset.id });
            expect(assetApiV3Schema.safeParse(response).success).toBe(true);
            expect(response.id).toEqual(testAsset.id);
        });
    });

    describe(`getMods`, () => {
        test(`returns the latest matching version for each project`, async () => {
            const response = await caller.v3.mods.getMods({
                gameName: `trpcmods`,
                authors: [testUser.id],
            });

            expect(response).toHaveLength(1);
            expect(projectApiV3Schema.safeParse(response[0].project).success).toBe(true);
            expect(versionApiV3Schema.safeParse(response[0].version).success).toBe(true);
            expect(response[0].project.id).toBe(modsPublicProjectId);
            expect(response[0].version.id).toBe(modsVisibleVersionId);
            expect(response[0].version.semver).toBe(`2.0.0`);
        });

        test(`does not expose private versions to anonymous callers`, async () => {
            const response = anonymousCaller.v3.mods.getMods({
                gameName: `trpcmods`,
                status: [Status.Private],
            });

            await expect(response).rejects.toThrow();
        });
    });

    describe(`getProjectAndVersions`, () => {
        test(`returns a project with versions sorted newest first`, async () => {
            const response = await caller.v3.mods.getProjectAndVersions({
                projectId: modsPublicProjectId,
            });

            expect(projectApiV3Schema.safeParse(response.project).success).toBe(true);
            expect(response.versions).toHaveLength(2);
            for (const version of response.versions) {
                expect(versionApiV3Schema.safeParse(version).success).toBe(true);
            }
            expect(response.versions[0].semver).toBe(`2.0.0`);
            expect(response.versions[1].semver).toBe(`1.0.0`);
        });

        test(`does not expose private project versions to anonymous callers`, async () => {
            const response = await anonymousCaller.v3.mods.getProjectAndVersions({
                projectId: modsHiddenProjectId,
            });

            expect(projectApiV3Schema.safeParse(response.project).success).toBe(true);
            expect(response.versions).toEqual([]);
        });

        test(`returns not found for an unknown project`, async () => {
            await expect(caller.v3.mods.getProjectAndVersions({
                projectId: 999999999,
            })).rejects.toThrow(`Project not found.`);
        });
    });


});