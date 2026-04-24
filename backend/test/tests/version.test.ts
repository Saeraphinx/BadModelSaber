import { afterAll, afterEach, beforeAll, describe, expect, inject, Mock, MockInstance, test, vi } from "vitest";
import { DatabaseManager, Status, User, UserPermissions, Project, Game, Version, WebhookLogType, AlertType } from "../../src/shared/Database.ts";
import { createDummyProject, createDummyUser, createDummyVersion, handleException } from "../testTools.ts";
import { Webhooks } from "../../src/shared/Webhooks.ts";
import { time } from "node:console";
import { string } from "zod";

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
            status: Status.Verified,
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
    });

    describe.sequential("setStatus", () => {
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
            returnWebhookExpect(WebhookLogType.NewlyVerifiedVersion);
            expect(webhookMock).toHaveBeenCalledTimes(3);
            expect(alertMock).toHaveBeenCalledTimes(1);
            expect(alertMock).toHaveBeenCalledWith(expect.objectContaining({
                type: AlertType.ThingVerified,
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
                type: AlertType.ThingRemoval,
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
                type: AlertType.ThingRemoval,
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