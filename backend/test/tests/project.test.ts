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

        test(`checks loaded authors and denies unrelated users for private projects`, async () => {
            const author = createDummyUser(54321, []);
            project.status = Status.Private;
            project.authors = [author];
            try {
                expect(await project.canView(author)).toBe(true);
                expect(await project.canView(createDummyUser(54322, []))).toBe(false);
                expect(await project.canView(undefined)).toBe(false);
            } finally {
                project.authors = undefined;
            }
        });

        test(`uses game-specific Mods_ViewAll permissions`, async () => {
            project.status = Status.Private;
            project.authors = [testUser];
            const moderator = createDummyUser(54321, {
                sitewide: [],
                perGame: { beatsaber: [UserPermissions.Mods_ViewAll] },
            });
            const otherGameModerator = createDummyUser(54322, {
                sitewide: [],
                perGame: { anothergame: [UserPermissions.Mods_ViewAll] },
            });
            try {
                expect(await project.canView(moderator)).toBe(true);
                expect(await project.canView(otherGameModerator)).toBe(false);
            } finally {
                project.authors = undefined;
            }
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

        test(`requires Mods_Edit for an author even with Mods_EditAll`, async () => {
            const authorWithoutPermission = createDummyUser(54321, []);
            project.authors = [authorWithoutPermission];
            try {
                expect(await project.canEdit(authorWithoutPermission)).toBe(false);
                expect(await project.canEdit(createDummyUser(54321, [UserPermissions.Mods_EditAll]))).toBe(false);
                expect(await project.canEdit(createDummyUser(54321, [UserPermissions.Mods_Edit]))).toBe(true);
                expect(await project.canEdit(null)).toBe(false);
            } finally {
                project.authors = undefined;
            }
        });

        test(`uses game-specific edit permissions`, async () => {
            project.authors = [testUser];
            const moderator = createDummyUser(54321, {
                sitewide: [],
                perGame: { beatsaber: [UserPermissions.Mods_EditAll] },
            });
            const otherGameModerator = createDummyUser(54322, {
                sitewide: [],
                perGame: { anothergame: [UserPermissions.Mods_EditAll] },
            });
            const author = createDummyUser(testUser.id, {
                sitewide: [],
                perGame: { beatsaber: [UserPermissions.Mods_Edit] },
            });
            try {
                expect(await project.canEdit(moderator)).toBe(true);
                expect(await project.canEdit(otherGameModerator)).toBe(false);
                expect(await project.canEdit(author)).toBe(true);
            } finally {
                project.authors = undefined;
            }
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

        test(`allows authors and collaborators without special permissions`, async () => {
            const author = createDummyUser(54321, []);
            const collaborator = createDummyUser(54322, []);
            const previousCollaborators = project.collaboratorIds;
            project.authors = [author];
            project.collaboratorIds = [collaborator.id];
            try {
                expect(await project.canUploadVersion(author)).toBe(true);
                expect(await project.canUploadVersion(collaborator)).toBe(true);
                expect(await project.canUploadVersion(createDummyUser(54323, []))).toBe(false);
                expect(await project.canUploadVersion(null)).toBe(false);
            } finally {
                project.authors = undefined;
                project.collaboratorIds = previousCollaborators;
            }
        });

        test(`uses game-specific Mods_UploadAll permissions`, async () => {
            project.authors = [testUser];
            const moderator = createDummyUser(54321, {
                sitewide: [],
                perGame: { beatsaber: [UserPermissions.Mods_UploadAll] },
            });
            const otherGameModerator = createDummyUser(54322, {
                sitewide: [],
                perGame: { anothergame: [UserPermissions.Mods_UploadAll] },
            });
            try {
                expect(await project.canUploadVersion(moderator)).toBe(true);
                expect(await project.canUploadVersion(otherGameModerator)).toBe(false);
            } finally {
                project.authors = undefined;
            }
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

        test(`allows authors and collaborators without special permissions`, async () => {
            const author = createDummyUser(54321, []);
            const collaborator = createDummyUser(54322, []);
            const previousCollaborators = project.collaboratorIds;
            project.authors = [author];
            project.collaboratorIds = [collaborator.id];
            try {
                expect(await project.canTranslate(author)).toBe(true);
                expect(await project.canTranslate(collaborator)).toBe(true);
                expect(await project.canTranslate(createDummyUser(54323, []))).toBe(false);
                expect(await project.canTranslate(null)).toBe(false);
            } finally {
                project.authors = undefined;
                project.collaboratorIds = previousCollaborators;
            }
        });

        test.each([UserPermissions.Mods_EditAll, UserPermissions.Mods_TranslateAll])(
            `uses game-specific %s permission`,
            async (permission) => {
                project.authors = [testUser];
                const moderator = createDummyUser(54321, {
                    sitewide: [],
                    perGame: { beatsaber: [permission] },
                });
                const otherGameModerator = createDummyUser(54322, {
                    sitewide: [],
                    perGame: { anothergame: [permission] },
                });
                try {
                    expect(await project.canTranslate(moderator)).toBe(true);
                    expect(await project.canTranslate(otherGameModerator)).toBe(false);
                } finally {
                    project.authors = undefined;
                }
            }
        );
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