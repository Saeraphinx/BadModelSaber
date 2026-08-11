import { afterAll, beforeAll, describe, expect, inject, test } from "vitest";
import { Asset, assetApiV3Schema, AssetFileFormat, DatabaseManager, Game, GameVersion, License, projectApiV3Schema, Status, Tags, User, UserPermissions, versionApiV3Schema } from "../../src/shared/Database";
import { createDummyAsset, createDummyProject, createDummyUser, createDummyVersion, handleException } from "../testTools";
import { createCaller } from "../../src/api/routers";
import { SemVer } from "semver";
import JSZip from "jszip";
    

const createTestCaller = (userId?: number) => createCaller({
    userId,
    req: {
        session: {
            userId,
            save: () => undefined,
        },
    } as any,
    res: {
        setHeader: () => undefined,
    } as any,
    db: {} as any,
});

const createPngFile = (name: string) => {
    const pngHeader = Uint8Array.from([137, 80, 78, 71, 13, 10, 26, 10]);
    return new File([pngHeader], name, { type: "image/png" });
};

const createZipFile = async (name: string) => {
    const zip = new JSZip();
    zip.file("readme.txt", "test");
    const data = await zip.generateAsync({ type: "uint8array" });
    return new File([data as BlobPart], name, { type: "application/zip" });
};

describe(`v3`, () => {
    let databaseManager: DatabaseManager;
    let testAsset: Asset;
    let testUser: User;
    let caller = createTestCaller(123456);
    let anonymousCaller = createTestCaller();
    let modsGameVersion: GameVersion;
    let privilegedCaller = createTestCaller(123458);
    let modsPublicProjectId: number;
    let modsVisibleVersionId: number;
    let modsHiddenProjectId: number;
    let createdProjectForUploadId: number | null = null;

    beforeAll(async () => {
        // @ts-ignore
        databaseManager = new DatabaseManager("test_trpc_v3", inject(`postgresUrl`));
        await databaseManager.init();
        //await databaseManager.importFakeData();

        try {
            testUser = await createDummyUser(123456).save();
            await createDummyUser(123458, [UserPermissions.Game_ViewExtras]).save();
            testAsset = await createDummyAsset(123456, undefined, {
                status: Status.Verified
            }).save();
            await createDummyAsset(123456, undefined, {
                status: Status.Unverified
            }).save();

            await Game.create({
                name: `trpcmods`,
                displayName: `TRPC Mods`,
                default: true,
                webhookConfig: [],
            });

            modsGameVersion = await GameVersion.create({
                gameName: `trpcmods`,
                version: `1.37.0`,
                isDefault: true,
            });

            await GameVersion.create({
                gameName: `trpcmods`,
                version: `1.36.0`,
                isDefault: false,
            });

            const hiddenAuthor = await createDummyUser(123457).save();

            const publicProject = await createDummyProject(`trpcmods`, undefined, {
                name: `TRPC Visible Mod`,
                nameId: `trpc-visible-mod`,
                status: Status.Public,
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
                status: Status.Public,
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

        test(`requires page and limit together`, async () => {
            await expect(caller.v3.assets.getAssets({ page: 1 } as any)).rejects.toThrow();
        });

        test(`returns asset by old id`, async () => {
            const legacyAsset = await createDummyAsset(testUser.id, undefined, {
                oldId: 987654,
                status: Status.Verified,
            }).save();

            const response = await caller.v3.assets.getAssetById({ id: 987654 });
            expect(response.id).toEqual(legacyAsset.id);
        });

        test(`returns multiple assets by id map and excludes private assets`, async () => {
            const privateAsset = await createDummyAsset(testUser.id, undefined, {
                status: Status.Private,
            }).save();

            const response = await anonymousCaller.v3.assets.getMultipleAssetsById({
                id: [testAsset.id, privateAsset.id],
            });

            expect(response[testAsset.id.toString()]).toBeDefined();
            expect(response[privateAsset.id.toString()]).toBeUndefined();
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

        test(`returns not found when filtering by unavailable game version`, async () => {
            await expect(caller.v3.mods.getMods({
                gameName: `trpcmods`,
                gameVersion: `9.9.9`,
            })).rejects.toThrow(`No game versions found`);
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

    describe(`games`, () => {
        test(`returns games without extras`, async () => {
            const response = await anonymousCaller.v3.games.getGames(false);
            expect(response.length).toBeGreaterThan(0);
            expect(response.some(g => g.name === `trpcmods`)).toBe(true);
            expect(response.every(g => g.webhooks === null)).toBe(true);
        });

        test(`requires Game_ViewExtras permission to include extras`, async () => {
            await expect(caller.v3.games.getGames(true)).rejects.toThrow(`permission`);
        });

        test(`returns game extras for privileged users`, async () => {
            const response = await privilegedCaller.v3.games.getGames(true);
            expect(response.length).toBeGreaterThan(0);
            expect(response.every(g => Array.isArray(g.webhooks))).toBe(true);
        });

        test(`returns sorted game versions`, async () => {
            const response = await anonymousCaller.v3.games.getGameVersions({
                gameName: `trpcmods`,
                includeExtras: false,
            });
            expect(response.game.name).toBe(`trpcmods`);
            expect(response.gameVersions.length).toBeGreaterThan(1);
            expect(response.gameVersions[0].version).toBe(`1.37.0`);
            expect(response.gameVersions[1].version).toBe(`1.36.0`);
        });

        test(`returns not found for unknown game`, async () => {
            await expect(anonymousCaller.v3.games.getGameVersions({
                gameName: `does-not-exist`,
                includeExtras: false,
            })).rejects.toThrow(`not found`);
        });
    });

    describe(`user`, () => {
        test(`returns current logged in user`, async () => {
            const response = await caller.v3.user.getMe();
            expect(response.id).toBe(testUser.id);
            expect(response.githubId).toBeNull();
            expect(response.discordId).toBeTruthy();
        });

        test(`getMe rejects anonymous callers`, async () => {
            await expect(anonymousCaller.v3.user.getMe()).rejects.toThrow();
        });

        test(`returns user by id`, async () => {
            const response = await anonymousCaller.v3.user.getUserById({ id: testUser.id });
            expect(response.id).toBe(testUser.id);
        });

        test(`getUserById returns not found for unknown user`, async () => {
            await expect(anonymousCaller.v3.user.getUserById({ id: 42424242 })).rejects.toThrow(`User not found`);
        });

        test(`returns assets uploaded by a user`, async () => {
            const response = await anonymousCaller.v3.user.getAssetsByUserId({ id: testUser.id });
            expect(response.total).toBeGreaterThan(0);
            expect(response.assets.some(asset => asset.id === testAsset.id)).toBe(true);
        });

        test(`returns mods authored by a user`, async () => {
            const response = await anonymousCaller.v3.user.getModsByUserId({ id: testUser.id });
            expect(response.some(project => project.id === modsPublicProjectId)).toBe(true);
        });
    });

    describe(`upload`, () => {
        test(`uploads an asset`, async () => {
            const form = new FormData();
            form.set("data", JSON.stringify({
                type: AssetFileFormat.Banner_Png,
                name: `TRPC Upload Banner`,
                renderingMethod: null,
                description: `Test asset upload`,
                license: License.CC0,
                licenseUrl: null,
                sourceUrl: null,
                gameName: `trpcmods`,
                tags: [],
            }));
            form.set("asset", createPngFile("banner.png"));
            form.set("icon_1", createPngFile("icon.png"));

            const response = await caller.v3.upload.assetUpload(form as any);
            expect(assetApiV3Schema.safeParse(response).success).toBe(true);
            expect(response.name).toBe(`TRPC Upload Banner`);
        });

        test(`creates a project`, async () => {
            const form = new FormData();
            form.set("data", JSON.stringify({
                name: `TRPC Upload Project`,
                nameId: `trpc-upload-project`,
                description: `Upload project test`,
                category: `Other`,
                gameName: `trpcmods`,
                gitUrl: `https://example.com/project`,
                summary: `Upload summary`,
            }));
            form.set("icon_1", createPngFile("project-icon.png"));

            const response = await caller.v3.upload.projectCreate(form as any);
            expect(projectApiV3Schema.safeParse(response).success).toBe(true);
            createdProjectForUploadId = response.id;
        });

        test(`uploads a project version`, async () => {
            if (!createdProjectForUploadId) {
                throw new Error(`Project upload test did not create a project.`);
            }

            const form = new FormData();
            form.set("id", createdProjectForUploadId.toString());
            form.set("data", JSON.stringify({
                platform: `universal`,
                dependencies: [],
                semver: `3.4.5`,
                supportedGameVersionIds: [modsGameVersion.id],
            }));
            form.set("modZip", await createZipFile("mod.zip"));

            const response = await caller.v3.upload.versionUpload(form);
            expect(versionApiV3Schema.safeParse(response).success).toBe(true);
            expect(response.semver).toBe(`3.4.5`);
        });
    });
});