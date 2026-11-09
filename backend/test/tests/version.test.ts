import { afterAll, afterEach, beforeAll, describe, expect, inject, Mock, MockInstance, test, vi } from "vitest";
import { DatabaseManager, Status, User, UserPermissions, Project, Game, Version, WebhookLogType, AlertType } from "../../src/shared/Database.ts";
import { createDummyProject, createDummyUser, createDummyVersion, handleException } from "../testTools.ts";
import { Webhooks } from "../../src/shared/Webhooks.ts";
import { time } from "node:console";
import { string } from "zod";
import { EnvConfig } from "../../src/shared/EnvConfig.ts";

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
        project = await createDummyProject(`beatsaber`, undefined, {
            status: Status.Public,
        }).save();
        version = await createDummyVersion(project.id, testUser.id).save();
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
            expect(await version.canView(null)).toBe(true);
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

        test(`uses the supplied project instead of loading the version's project`, async () => {
            version.status = Status.Verified;
            const projectGetter = vi.spyOn(version, `project`, `get`);
            try {
                expect(await version.canView(null, project)).toBe(true);
                expect(projectGetter).not.toHaveBeenCalled();
            } finally {
                projectGetter.mockRestore();
            }
        });

        test(`returns false if the parent project cannot be found`, async () => {
            const projectGetter = vi.spyOn(version, `project`, `get`).mockResolvedValue(null);
            try {
                expect(await version.canView(testUser)).toBe(false);
            } finally {
                projectGetter.mockRestore();
            }
        });

        test(`does not expose a version when its project is not visible`, async () => {
            const hiddenProject = createDummyProject(`beatsaber`, undefined, { status: Status.Private });
            hiddenProject.authors = [createDummyUser(54321)];
            version.status = Status.Verified;

            expect(await version.canView(null, hiddenProject)).toBe(false);
            expect(await version.canView(testUser, hiddenProject)).toBe(false);
        });

        test(`allows the uploader to view a private version of a visible project`, async () => {
            version.status = Status.Private;
            project.authors = [createDummyUser(54321)];
            try {
                expect(await version.canView(testUser, project)).toBe(true);
            } finally {
                project.authors = undefined;
            }
        });

        test(`checks loaded project authors independently of the uploader`, async () => {
            const author = createDummyUser(54321);
            const unrelatedUser = createDummyUser(54322);
            version.status = Status.Private;
            project.authors = [author];
            try {
                expect(await version.canView(author, project)).toBe(true);
                expect(await version.canView(unrelatedUser, project)).toBe(false);
                expect(await version.canView(undefined, project)).toBe(false);
            } finally {
                project.authors = undefined;
            }
        });

        test(`fetches project authors when they are not loaded or are empty`, async () => {
            const author = await createDummyUser(54321).save();
            await project.$set(`authors`, [author]);
            version.status = Status.Private;
            try {
                project.authors = undefined;
                expect(await version.canView(author, project)).toBe(true);
                expect(await version.canView(createDummyUser(54322), project)).toBe(false);
                project.authors = [];
                expect(await version.canView(author, project)).toBe(true);
            } finally {
                project.authors = undefined;
                await project.$set(`authors`, [testUser]);
            }
        });

        test(`applies game-specific Mods_ViewAll permissions`, async () => {
            const moderator = createDummyUser(54323, {
                sitewide: [],
                perGame: { beatsaber: [UserPermissions.Mods_ViewAll] },
            });
            const otherGameModerator = createDummyUser(54324, {
                sitewide: [],
                perGame: { anothergame: [UserPermissions.Mods_ViewAll] },
            });
            version.status = Status.Private;

            expect(await version.canView(moderator, project)).toBe(true);
            expect(await version.canView(otherGameModerator, project)).toBe(false);
        });
    });

    describe("canEdit", () => {
        test(`true for author`, async () => {
            await project.$set(`authors`, [testUser]);
            expect(await version.canEdit(testUser)).toBe(true);
        });

        test(`false for other users`, async () => {
            expect(await version.canEdit(undefined)).toBe(false);
            expect(await version.canEdit(createDummyUser(54321))).toBe(false);
        });

        test(`true for users with Mods_EditAll permission`, async () => {
            expect(await version.canEdit(createDummyUser(4321, [UserPermissions.Mods_EditAll]))).toBe(true);
        });

        test(`uses the supplied project and forwards the user and result`, async () => {
            const projectGetter = vi.spyOn(version, `project`, `get`);
            const canEdit = vi.spyOn(project, `canEdit`).mockResolvedValue(false);
            try {
                expect(await version.canEdit(testUser, project)).toBe(false);
                expect(canEdit).toHaveBeenCalledWith(testUser);
                expect(projectGetter).not.toHaveBeenCalled();

                canEdit.mockResolvedValue(true);
                expect(await version.canEdit(null, project)).toBe(true);
                expect(canEdit).toHaveBeenCalledWith(null);
            } finally {
                projectGetter.mockRestore();
                canEdit.mockRestore();
            }
        });

        test(`loads the parent project when one is not supplied`, async () => {
            const projectGetter = vi.spyOn(version, `project`, `get`).mockResolvedValue(project);
            const canEdit = vi.spyOn(project, `canEdit`).mockResolvedValue(true);
            try {
                expect(await version.canEdit(testUser)).toBe(true);
                expect(projectGetter).toHaveBeenCalled();
                expect(canEdit).toHaveBeenCalledWith(testUser);
            } finally {
                projectGetter.mockRestore();
                canEdit.mockRestore();
            }
        });

        test(`returns false when the parent project is missing`, async () => {
            const projectGetter = vi.spyOn(version, `project`, `get`).mockResolvedValue(null);
            try {
                expect(await version.canEdit(testUser)).toBe(false);
            } finally {
                projectGetter.mockRestore();
            }
        });

        test(`requires Mods_Edit for project authors`, async () => {
            const authorWithoutPermission = createDummyUser(54325, []);
            const authorWithPermission = createDummyUser(54325, [UserPermissions.Mods_Edit]);
            project.authors = [authorWithoutPermission];
            try {
                expect(await version.canEdit(authorWithoutPermission, project)).toBe(false);
                expect(await version.canEdit(authorWithPermission, project)).toBe(true);
                expect(await version.canEdit(null, project)).toBe(false);
            } finally {
                project.authors = undefined;
            }
        });

        test(`applies game-specific Mods_EditAll permissions for non-authors`, async () => {
            const moderator = createDummyUser(54326, {
                sitewide: [],
                perGame: { beatsaber: [UserPermissions.Mods_EditAll] },
            });
            const otherGameModerator = createDummyUser(54327, {
                sitewide: [],
                perGame: { anothergame: [UserPermissions.Mods_EditAll] },
            });
            project.authors = [testUser];
            try {
                expect(await version.canEdit(moderator, project)).toBe(true);
                expect(await version.canEdit(otherGameModerator, project)).toBe(false);
            } finally {
                project.authors = undefined;
            }
        });
    });

    describe("setStatus", { concurrent: false }, () => {
        let webhookMock: MockInstance<any>;
        let alertMock: MockInstance<any>;
        beforeAll(async () => {
            // mock webhooks to prevent actual webhook calls during testing
            webhookMock = vi.spyOn(Webhooks, `sendWebhookLog`).mockResolvedValue(undefined);
            alertMock = vi.spyOn(Version.prototype, `createAlert`);
        })

        afterAll(async () => {
            vi.restoreAllMocks();
        });

        afterEach(async () => {
            // reset version status and history after each test
            version.status = Status.Private;
            version.statusHistory = [];
            version.lastApprovedById = null;
            await version.save();
            webhookMock.mockClear();
            alertMock.mockClear();
        });

        test(`first time private -> verified sends approval webhook`, async () => {
            await version.setStatus(Status.Verified, testUser, `Initial approval`);
            returnWebhookExpect(WebhookLogType.StatusUpdate);
            returnWebhookExpect(WebhookLogType.Text_StatusUpdate);
            returnWebhookExpect(WebhookLogType.FirstVerificationVersion);
            expect(webhookMock).toHaveBeenCalledTimes(3);
            expect(alertMock).toHaveBeenCalledTimes(1);
            expect(alertMock).toHaveBeenCalledWith(expect.objectContaining({
                type: AlertType.ThingGood,
            }));
            expect(version.lastApprovedById).toBe(testUser.id);
            expect(version.status).toBe(Status.Verified);
            expect(version.statusHistory).toHaveLength(1);
            expect(version.statusHistory[0]).toMatchObject({
                status: Status.Verified,
                reason: `Initial approval`,
                userId: testUser.id,
                timestamp: expect.any(String),
            });
        });

        test(`private -> verified -> unverified does not send approval webhook`, async () => {
            await version.setStatus(Status.Verified, testUser, `Initial approval`);
            webhookMock.mockClear();
            alertMock.mockClear();
            await version.setStatus(Status.Unverified, testUser, `Needs work`);
            returnWebhookExpect(WebhookLogType.StatusUpdate);
            returnWebhookExpect(WebhookLogType.Text_StatusUpdate);
            expect(webhookMock).toHaveBeenCalledTimes(2);
            expect(alertMock).toHaveBeenCalledTimes(1);
            expect(alertMock).toHaveBeenCalledWith(expect.objectContaining({
                type: AlertType.ThingBad,
            }));
            expect(version.status).toBe(Status.Unverified);
            expect(version.statusHistory).toHaveLength(2);
            expect(version.statusHistory[1]).toMatchObject({
                status: Status.Unverified,
                reason: `Needs work`,
                userId: testUser.id,
                timestamp: expect.any(String),
            });
        });

        test(`verified -> removed does not send special webhooks`, async () => {
            await version.setStatus(Status.Verified, testUser, `Initial approval`);
            webhookMock.mockClear();
            alertMock.mockClear();
            await version.setStatus(Status.Removed, testUser, `Inappropriate content`);
            returnWebhookExpect(WebhookLogType.StatusUpdate);
            returnWebhookExpect(WebhookLogType.Text_StatusUpdate);
            expect(webhookMock).toHaveBeenCalledTimes(2);
            expect(alertMock).toHaveBeenCalledTimes(1);
            expect(alertMock).toHaveBeenCalledWith(expect.objectContaining({
                type: AlertType.ThingBad,
            }));
            expect(version.status).toBe(Status.Removed);
            expect(version.statusHistory).toHaveLength(2);
            expect(version.statusHistory[1]).toMatchObject({
                status: Status.Removed,
                reason: `Inappropriate content`,
                userId: testUser.id,
                timestamp: expect.any(String),
            });
        });
    });
});

function returnWebhookExpect(type: WebhookLogType, not: boolean = false) {
    if (not) {
        expect(Webhooks.sendWebhookLog).not.toHaveBeenCalledWith(
            `beatsaber`,
            type,
            expect.anything(),
            expect.anything()
        );
    } else {
        expect(Webhooks.sendWebhookLog).toHaveBeenCalledWith(
            `beatsaber`,
            type,
            false,
            expect.anything()
        );
    }
}