import { afterAll, beforeAll, describe, expect, inject, test } from "vitest";
import { Alert, Asset, AssetFileFormat, AssetInfer, ThingRequest, DatabaseManager, License, RequestType, Status, Tags, User, UserPermissions, Project, Game, Version } from "../../src/shared/Database.ts";
import { createDummyAsset, createDummyProject, createDummyUser, createDummyVersion, handleException } from "../testTools.ts";
import { Translation } from "../../src/shared/database/tables/Translation.ts";

describe("versions", () => {
    let databaseManager: DatabaseManager;
    let project: Project;
    let version: Version;
    let testUser: User;

    beforeAll(async () => {
        // @ts-ignore
        databaseManager = new DatabaseManager("test_versions", inject(`postgresUrl`));
        await databaseManager.init();
        await Game.create({
            name: `beatsaber`,
            displayName: `Beat Saber`,
            default: true,
            webhookConfig: []
        });
            
        testUser = await createDummyUser(12345).save();
        project = await createDummyProject(`beatsaber`).save();
        version = await createDummyVersion(project.id).save();
    });

    afterAll(async () => {
        await databaseManager.dropSchema().catch(console.error);
        await databaseManager.closeConnenction().catch(console.error);
    });

    // #region Permission tests
    describe("canView", () => {
        test(`true for verified & unverified (logged in) versions`, async () => {
            version.status = Status.Verified;
            expect(await version.canView(null)).toBe(true);
            version.status = Status.Unverified;
            expect(await version.canView(null)).toBe(false);
            expect(await version.canView(createDummyUser(54321))).toBe(true);
        });

        test(`false for private versions`, async () => {
            version.status = Status.Private;
            expect(await version.canView(null)).toBe(false);
        });
    
        test(`true for private versions if user is author`, async () => {
            version.status = Status.Private;
            await project.$set(`authors`, [testUser]);
            expect(await version.canView(testUser)).toBe(true);
        });

        test(`true for private versions if user has Mods_ViewAll permission`, async () => {
            version.status = Status.Private;
            expect(await version.canView(createDummyUser(4321, [UserPermissions.Mods_ViewAll]))).toBe(true);
        });
    });
});