import { afterAll, beforeAll, describe, expect, inject, test } from "vitest";
import { Alert, Asset, AssetFileFormat, AssetInfer, ThingRequest, DatabaseManager, License, RequestType, Status, Tags, User, UserPermissions, Project, Game } from "../../src/shared/Database.ts";
import { createDummyAsset, createDummyProject, createDummyUser, handleException } from "../testTools.ts";
import { Translation } from "../../src/shared/database/tables/Translation.ts";

describe("projects", () => {
    let databaseManager: DatabaseManager;
    let project: Project;
    let testUser: User;

    beforeAll(async () => {
        // @ts-ignore
        databaseManager = new DatabaseManager("test_projects", inject(`postgresUrl`));
        await databaseManager.init();
        await Game.create({
            name: `beatsaber`,
            displayName: `Beat Saber`,
            default: true,
            webhookConfig: []
        });
            
        testUser = await createDummyUser(12345).save();
        project = await createDummyProject(`beatsaber`).save();
    });

    afterAll(async () => {
        await databaseManager.dropSchema().catch(console.error);
        await databaseManager.closeConnenction().catch(console.error);
    });

    // #region Permission tests
    describe("canView", () => {
        test(`true for public projects`, async () => {
            project.status = Status.Public;
            expect(await project.canView(null)).toBe(true);
            expect(await project.canView(createDummyUser(54321))).toBe(true);
        });
    
        test(`false for private projects`, async () => {
            project.status = Status.Private;
            expect(await project.canView(null)).toBe(false);
        });
    
        test(`true for private projects if user is author`, async () => {
            project.status = Status.Private;
            await project.$set(`authors`, [testUser.id]);
            expect(await project.canView(testUser)).toBe(true);
        });

        test(`true for private projects if user has Mods_ViewAll permission`, async () => {
            project.status = Status.Private;
            expect(await project.canView(createDummyUser(4321, [UserPermissions.Mods_ViewAll]))).toBe(true);
        });
    });

    describe("canEdit", () => {
        test(`true for author`, async () => {
            await project.$set(`authors`, [testUser.id]);
            //console.log(`testUser:`, testUser);
            //console.log(`project authors:`, await project.$get(`authors`));
            expect(await project.canEdit(testUser)).toBe(true);
        });

        test(`false for other users`, async () => {
            expect(await project.canEdit(undefined)).toBe(false);
            expect(await project.canEdit(createDummyUser(54321))).toBe(false);
        });

        test(`true for users with Mods_EditAll permission`, async () => {
            expect(await project.canEdit(createDummyUser(4321, [UserPermissions.Mods_EditAll]))).toBe(true);
        });
    });

    describe("canUpload", () => {
        test(`true for author`, async () => {
            await project.$set(`authors`, [testUser]);
            expect(await project.canUploadVersion(testUser)).toBe(true);
        });

        test(`false for other users`, async () => {
            expect(await project.canUploadVersion(undefined)).toBe(false);
            expect(await project.canUploadVersion(createDummyUser(54321))).toBe(false);
        });

        test(`true for users with Mods_UploadAll permission`, async () => {
            expect(await project.canUploadVersion(createDummyUser(4321, [UserPermissions.Mods_UploadAll]))).toBe(true);
        });
    });

    describe("canTranslate", () => {
        test(`true for author`, async () => {
            await project.$set(`authors`, [testUser]);
            expect(await project.canTranslate(testUser)).toBe(true);
        });

        test(`false for other users`, async () => {
            expect(await project.canTranslate(undefined)).toBe(false);
            expect(await project.canTranslate(createDummyUser(54321))).toBe(false);
        });

        test(`true for users with Mods_TranslateAll permission`, async () => {
            expect(await project.canTranslate(createDummyUser(4321, [UserPermissions.Mods_TranslateAll]))).toBe(true);
        });
    });
    // #endregion
    // #region Translation tests
    describe("getTranslation", () => {
        test(`returns null if no translation exists for the specified language`, async () => {
            let translation = await project.getTranslation(`fr`);
            expect(translation).toBeNull();
        });

        test(`returns translation for specified language if it exists`, async () => {
            let translation = await project.getTranslation(`fr`);
            expect(translation).toBeNull();
            let newTranslation = await Translation.create({
                parentId: project.id,
                contentType: `name`,
                language: `fr`,
                originalString: project.name,
                translatedString: `Nom du projet`,
                outOfDate: false,
                translatedBy: testUser.id,
            });

            let fetchedTranslation = await project.getTranslation(`fr`);
            expect(fetchedTranslation).not.toBeNull();
            expect(fetchedTranslation?.name).toBe(`Nom du projet`);
            expect(fetchedTranslation?.summary).toBeNull();
            expect(fetchedTranslation?.description).toBeNull();
        });
    });
    // #endregion
    // #region Update tests
    describe("updateProject", () => {
        test(`updates project fields correctly & marks translations as out of date`, async () => {
            let translation = await Translation.create({
                parentId: project.id,
                contentType: `summary`,
                language: `en2`,
                originalString: project.summary,
                translatedString: `Test Project Summary`,
                outOfDate: false,
                translatedBy: testUser.id,
            });
            let updatedProject = await project.updateProject({
                summary: `This is an updated test project`,
                description: `This is an updated test project description`,
            }, testUser);
            expect(updatedProject.summary).toBe(`This is an updated test project`);
            expect(updatedProject.description).toBe(`This is an updated test project description`);
            translation = await translation.reload();
            expect(translation.outOfDate).toBe(true);
        });
    });
    // #endregion
});