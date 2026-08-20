import { afterAll, beforeAll, describe, expect, inject, test } from "vitest";
import { Asset, assetApiV3Schema, AssetFileFormat, DatabaseManager, Game, GameVersion, License, ModApiv2, ModVersionsApiv2, projectApiV3Schema, Status, Tags, User, UserPermissions, Version, versionApiV3Schema } from "../../src/shared/Database";
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

describe(`v3`, () => {
    let databaseManager: DatabaseManager;
    let testUser: User;
    let caller = createTestCaller(123456);
    let anonymousCaller = createTestCaller();
    let modsGameVersion: GameVersion;
    let modsPublicProjectId: number;
    let modsVisibleVersionId: number;


    beforeAll(async () => {
        // @ts-ignore
        databaseManager = new DatabaseManager("test_trpc_v3", inject(`postgresUrl`));
        await databaseManager.init();
        //await databaseManager.importFakeData();

        try {
            testUser = await createDummyUser(123456).save();
            await createDummyUser(123458, [UserPermissions.Game_ViewExtras]).save();
            await createDummyAsset(123456, undefined, {
                status: Status.Unverified
            }).save();

            await Game.create({
                name: `beatsaber`,
                displayName: `Beat Saber`,
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
                zipHash: `bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb`,
                contentHashes: [{
                    path: `mod.json`,
                    hash: `aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa`,
                }]
            }).save();
            await olderVersion.$set(`supportedGameVersions`, [modsGameVersion]);

            const latestVersion = await createDummyVersion(publicProject.id, testUser.id, undefined, {
                semver: new SemVer(`2.0.0`),
                status: Status.Unverified,
                lastUpdatedById: testUser.id,
            }).save();
            await latestVersion.$set(`supportedGameVersions`, [modsGameVersion]);

            modsPublicProjectId = publicProject.id;
            modsVisibleVersionId = latestVersion.id;
        } catch (error) {
            console.error(`Error setting up test data:`, error);
            handleException(error)();
        }
    });

    afterAll(async () => {
        await databaseManager.dropSchema().catch(console.error);
        await databaseManager.closeConnenction().catch(console.error);
    });

    describe.sequential(`Get Mods`, () => {
        test(`/mods - no param`, async () => {
            const response = await anonymousCaller.v2.mods.getMods({});

            expect(response).toBeDefined();
            expect(response).toHaveProperty(`mods`);
            expect(response.mods).toBeInstanceOf(Array);
            expect(response.mods.length).toBeGreaterThan(0);

            for (const currentMod of response.mods) {
                expect(currentMod).toHaveProperty(`mod`);
                expect(currentMod).toHaveProperty(`latest`);
            }
        });

        test(`/mods - gv only`, async () => {
            const response = await anonymousCaller.v2.mods.getMods({
                gameVersion: `1.0.0`,
            });

            expect(response).toBeDefined();
            expect(response).toHaveProperty(`mods`);
            expect(response.mods).toBeInstanceOf(Array);
            expect(response.mods.length).toBeGreaterThan(0);

            const mods = response.mods;
            for (const cmod of response.mods) {
                const currentMod = cmod as { mod: ModApiv2, latest: ModVersionsApiv2 };
                expect(currentMod).toHaveProperty(`mod`);
                expect(currentMod).toHaveProperty(`latest`);

                const dependencies = mods.filter((mod) => currentMod.latest.dependencies.includes(mod.latest.id));
                expect(dependencies.length).toBe(currentMod.latest.dependencies.length);
                expect(currentMod.latest.supportedGameVersions.find((gv) => gv.version === `1.0.0`)).toBeDefined();
            }
        });

        test(`/mods - gv and universal platform`, async () => {
            const response = await anonymousCaller.v2.mods.getMods({
                gameVersion: `1.0.0`,
                platform: `universalpc`,
            });

            expect(response).toBeDefined();
            expect(response).toHaveProperty(`mods`);
            expect(response.mods).toBeInstanceOf(Array);
            expect(response.mods.length).toBeGreaterThan(0);

            const mods = response.mods;
            for (const cmod of response.mods) {
                const currentMod = cmod as { mod: ModApiv2, latest: ModVersionsApiv2 };
                expect(currentMod).toHaveProperty(`mod`);
                expect(currentMod).toHaveProperty(`latest`);

                const dependencies = mods.filter((mod) => currentMod.latest.dependencies.includes(mod.latest.id));
                expect(dependencies.length).toBe(currentMod.latest.dependencies.length);
                expect(currentMod.latest.supportedGameVersions.find((gv) => gv.version === `1.0.0`)).toBeDefined();
                expect(currentMod.latest.platform).toBe(`universalpc`);
            }
        });

        test(`/hashlookup - contentHash`, async () => {
            const contentHash = `aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa`;
            const response = await anonymousCaller.v2.mods.hashLookup({
                hash: contentHash,
            });

            expect(response).toBeDefined();
            expect(response).toHaveProperty(`modVersions`);
            expect(response.modVersions).toBeInstanceOf(Array);
        });

        test(`/hashlookup - ziphash`, async () => {
            const zipHash = `bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb`;
            const response = await anonymousCaller.v2.mods.hashLookup({
                hash: zipHash,
            });

            expect(response).toBeDefined();
            expect(response).toHaveProperty(`modVersions`);
            expect(response.modVersions).toBeInstanceOf(Array);
        });

        test(`/multi/hashlookup - contentHash`, async () => {
            const contentHash1 = `aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa`;
            const contentHash2 = `bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb`;
            const response = await anonymousCaller.v2.mods.multiHashLookup({
                hashes: [contentHash1, contentHash2],
            });

            expect(response).toBeDefined();
            expect(response).toHaveProperty(`hashes`);
            expect(response.hashes).toBeInstanceOf(Object);
        });

        test(`/multi/hashlookup - zipHash`, async () => {
            const zipHash1 = `cccccccccccccccccccccccccccccccc`;
            const zipHash2 = `dddddddddddddddddddddddddddddddd`;
            const response = await anonymousCaller.v2.mods.multiHashLookup({
                hashes: [zipHash1, zipHash2],
            });

            expect(response).toBeDefined();
            expect(response).toHaveProperty(`hashes`);
            expect(response.hashes).toBeInstanceOf(Object);
        });
    });
});