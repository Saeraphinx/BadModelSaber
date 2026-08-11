import fs from "node:fs";
import path from "node:path";
import { afterAll, beforeAll, describe, expect, inject, test } from "vitest";
import {
    Alert,
    AlertType,
    Asset,
    DatabaseManager,
    Game,
    GameVersion,
    LinkedAssetLinkType,
    Project,
    RequestType,
    Status,
    ThingRequest,
    User,
    UserPermissions,
    Version,
} from "../../src/shared/Database";
import { createDummyAsset, createDummyProject, createDummyUser, createDummyVersion, handleException } from "../testTools";
import { createCaller } from "../../src/api/routers";
import { SemVer } from "semver";

const randomHash = () => Math.random().toString(36).slice(2) + Date.now().toString(36);

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

describe("trpc-internal", () => {
    let databaseManager: DatabaseManager;
    let schemaName: string;

    let caller = createTestCaller(123456);
    let otherCaller = createTestCaller(123457);
    let anonymousCaller = createTestCaller();

    let testUser: User;
    let otherUser: User;
    let testAsset: Asset;
    let otherAsset: Asset;
    let testProject: Project;
    let testVersion: Version;
    let queueVersion: Version;
    let testGameVersion: GameVersion;

    beforeAll(async () => {
        // @ts-ignore
        databaseManager = new DatabaseManager("test_trpc_int", inject(`postgresUrl`));
        await databaseManager.init();

        try {
            await Game.create({
                name: `beatsaber`,
                displayName: `Beat Saber`,
                default: true,
                webhookConfig: [],
            });

            testGameVersion = await GameVersion.create({
                gameName: `beatsaber`,
                version: `1.37.0`,
                isDefault: true,
            });

            const widePerms = [
                UserPermissions.Users_EditSelf,
                UserPermissions.Administrative_Tasks,
                UserPermissions.Asset_Edit,
                UserPermissions.Asset_EditAll,
                UserPermissions.Asset_Create,
                UserPermissions.Asset_Approval,
                UserPermissions.Asset_InternalTags,
                UserPermissions.Mods_Create,
                UserPermissions.Mods_Edit,
                UserPermissions.Mods_EditAll,
                UserPermissions.Mods_ViewAll,
                UserPermissions.Mods_Approval,
                UserPermissions.Mods_TranslateAll,
                UserPermissions.Requests_ViewAssets,
                UserPermissions.Requests_ViewMods,
                UserPermissions.Requests_ViewUsers,
                UserPermissions.Requests_ViewAll,
                UserPermissions.Requests_ManageAssets,
                UserPermissions.Requests_ManageMods,
                UserPermissions.Requests_ManageUsers,
                UserPermissions.Requests_ManageAll,
                UserPermissions.Game_ViewExtras,
            ];

            testUser = await createDummyUser(123456, widePerms).save();
            otherUser = await createDummyUser(123457).save();

            testAsset = await createDummyAsset(testUser.id, undefined, {
                status: Status.Verified,
                tags: ["Featured" as any],
                name: `Internal Test Asset`,
                fileHash: randomHash(),
            }).save();

            otherAsset = await createDummyAsset(otherUser.id, undefined, {
                status: Status.Verified,
                name: `Other User Asset`,
                fileHash: randomHash(),
            }).save();

            testProject = await createDummyProject(`beatsaber`, undefined, {
                name: `Internal Test Project`,
                nameId: `internal-test-project`,
                status: Status.Public,
                isFeatured: true,
                lastUpdatedById: testUser.id,
            }).save();
            await testProject.$set(`authors`, [testUser.id]);

            testVersion = await createDummyVersion(testProject.id, testUser.id, undefined, {
                semver: new SemVer(`1.0.0`),
                status: Status.Private,
                lastUpdatedById: testUser.id,
            }).save();
            await testVersion.$set(`supportedGameVersions`, [testGameVersion]);

            queueVersion = await createDummyVersion(testProject.id, testUser.id, undefined, {
                semver: new SemVer(`1.1.0`),
                status: Status.Queue,
                lastUpdatedById: testUser.id,
            }).save();
            await queueVersion.$set(`supportedGameVersions`, [testGameVersion]);

            fs.mkdirSync(testProject.folderPath, { recursive: true });
        } catch (error) {
            console.error(`Error setting up test data:`, error);
            handleException(error)();
        }
    });

    afterAll(async () => {
        await databaseManager.dropSchema().catch(console.error);
        await databaseManager.closeConnenction().catch(console.error);
    });

    describe(`status`, () => {
        test(`status route returns health payload`, async () => {
            const status = await caller.internal.status.status();
            expect(status).toHaveProperty(`message`, `Server is running`);
            expect(status).toHaveProperty(`timestamp`);
            expect(status).toHaveProperty(`isDocker`);
            expect(status).toHaveProperty(`environment`);
            expect(status).toHaveProperty(`version`);
        });

        test(`adminStatus returns administrative diagnostics`, async () => {
            const status = await caller.internal.status.adminStatus();
            expect(status).toHaveProperty(`dbConnectionOK`, `Connected`);
            expect(status).toHaveProperty(`serverTime`);
            expect(status).toHaveProperty(`version`);
        });

        test(`adminStatus rejects anonymous callers`, async () => {
            await expect(anonymousCaller.internal.status.adminStatus()).rejects.toThrow();
        });
    });

    describe.sequential(`alerts`, () => {
        let unreadAlert: Alert;
        let readAlert: Alert;

        beforeAll(async () => {
            unreadAlert = await testUser.createAlert({
                type: AlertType.Generic,
                message: `This is an unread test alert`,
                header: `Unread Alert`,
            }, false);

            readAlert = await testUser.createAlert({
                type: AlertType.Generic,
                message: `This is a read test alert`,
                header: `Read Alert`,
            }, false);
            readAlert.read = true;
            await readAlert.save();
        });

        test(`getAlertCount returns unread count`, async () => {
            const count = await caller.internal.alerts.getAlertCount();
            expect(count).toBeGreaterThan(0);
        });

        test(`getAlerts supports read=true|false|all`, async () => {
            const onlyRead = await caller.internal.alerts.getAlerts({ read: `true` });
            const onlyUnread = await caller.internal.alerts.getAlerts({ read: `false` });
            const all = await caller.internal.alerts.getAlerts({ read: `all` });

            expect(onlyRead.every(a => a.read)).toBe(true);
            expect(onlyUnread.every(a => !a.read)).toBe(true);
            expect(all.length).toBeGreaterThanOrEqual(onlyRead.length);
            expect(all.length).toBeGreaterThanOrEqual(onlyUnread.length);
        });

        test(`markAlertRead marks alert as read`, async () => {
            const response = await caller.internal.alerts.markAlertRead({ id: unreadAlert.id });
            expect(response.read).toBe(true);
            await unreadAlert.reload();
            expect(unreadAlert.read).toBe(true);
        });

        test(`markAlertRead throws for another user's alert`, async () => {
            const otherAlert = await otherUser.createAlert({
                type: AlertType.Generic,
                message: `This is another user's alert`,
                header: `Other User Alert`,
            }, false);
            await expect(caller.internal.alerts.markAlertRead({ id: otherAlert.id })).rejects.toThrowError();
        });

        test(`deleteAlert deletes own alert and rejects others`, async () => {
            await caller.internal.alerts.deleteAlert({ id: readAlert.id });
            const deletedAlert = await Alert.findByPk(readAlert.id);
            expect(deletedAlert).toBeNull();

            const otherAlert = await otherUser.createAlert({
                type: AlertType.Generic,
                message: `This is another user's alert`,
                header: `Other User Alert`,
            }, false);
            await expect(caller.internal.alerts.deleteAlert({ id: otherAlert.id })).rejects.toThrowError();
        });
    });

    describe(`requests`, () => {
        let userReport: ThingRequest;
        let directCreditRequest: ThingRequest;

        beforeAll(async () => {
            userReport = await ThingRequest.create({
                refrencedId: otherUser.id,
                requesterId: testUser.id,
                refrencedGameName: null,
                requestType: RequestType.User_Report,
                requestResponseBy: testUser.id,
                objectToAdd: null,
                messages: [{ userId: testUser.id, message: `report reason`, timestamp: new Date().toISOString() }],
            });

            directCreditRequest = await ThingRequest.create({
                refrencedId: otherAsset.id,
                requesterId: otherUser.id,
                refrencedGameName: otherAsset.gameName,
                requestType: RequestType.Asset_Credit,
                requestResponseBy: testUser.id,
                objectToAdd: otherUser.id,
                messages: [{ userId: otherUser.id, message: `please credit me`, timestamp: new Date().toISOString() }],
            });
        });

        test(`getMyRequests returns incoming and outgoing`, async () => {
            const response = await caller.internal.requests.getMyRequests({ includeActioned: true });
            expect(Array.isArray(response.incoming)).toBe(true);
            expect(Array.isArray(response.outgoing)).toBe(true);
        });

        test(`getAllRequests returns visible requests for reviewer`, async () => {
            const response = await caller.internal.requests.getAllRequests({
                includeActioned: true,
                includeSpecificResponseBy: true,
            });
            expect(response.length).toBeGreaterThan(0);
        });

        test(`requestCounts returns pending counters`, async () => {
            const response = await caller.internal.requests.requestCounts();
            expect(response).toHaveProperty(`incoming`);
            expect(response).toHaveProperty(`outgoing`);
        });

        test(`getRequest returns a visible request`, async () => {
            const response = await caller.internal.requests.getRequest({ id: userReport.id });
            expect(response.id).toBe(userReport.id);
        });

        test(`addMessage appends message to request`, async () => {
            await caller.internal.requests.addMessage({ id: userReport.id, message: `follow-up` });
            await userReport.reload();
            expect(userReport.messages.some(m => m.message === `follow-up`)).toBe(true);
        });

        test(`handleRequest accepts/declines handled requests`, async () => {
            const accepted = await caller.internal.requests.handleRequest({
                id: directCreditRequest.id,
                action: `accept`,
                actuallyHandle: true,
            });
            expect(accepted.message).toContain(`accepted`);

            const declineCandidate = await ThingRequest.create({
                refrencedId: otherAsset.id,
                requesterId: otherUser.id,
                refrencedGameName: otherAsset.gameName,
                requestType: RequestType.Asset_Credit,
                requestResponseBy: testUser.id,
                objectToAdd: otherUser.id,
                messages: [{ userId: otherUser.id, message: `please decline`, timestamp: new Date().toISOString() }],
            });

            const declined = await caller.internal.requests.handleRequest({
                id: declineCandidate.id,
                action: `decline`,
            });
            expect(declined.message).toContain(`declined`);
        });

        test(`reportThing creates a report request`, async () => {
            const response = await caller.internal.requests.reportThing({
                thingId: otherAsset.id,
                thingType: `asset`,
                reason: `inappropriate upload`,
            });
            expect(response.requestType).toBe(RequestType.Asset_Report);
            expect(response.refrencedThingId).toBe(otherAsset.id);
        });

        test(`getAllRequests rejects users without request-view permissions`, async () => {
            await expect(otherCaller.internal.requests.getAllRequests({ includeActioned: true })).rejects.toThrow();
        });
    });

    describe(`getThings`, () => {
        test(`getProject and getBulkProjects return visible projects`, async () => {
            const single = await caller.internal.getThings.getProject({ projectId: testProject.id });
            expect(single.id).toBe(testProject.id);

            const bulk = await caller.internal.getThings.getBulkProjects({ projectIds: [testProject.id] });
            expect(bulk.some(project => project.id === testProject.id)).toBe(true);
        });

        test(`searchProjects and searchProjectsByNameId resolve public project identifiers`, async () => {
            const byName = await caller.internal.getThings.searchProjects({ query: `Internal Test`, gameName: `beatsaber` });
            expect(byName.some(project => project.id === testProject.id)).toBe(true);

            const byNameId = await caller.internal.getThings.searchProjectsByNameId({
                nameIds: [testProject.nameId],
                gameName: `beatsaber`,
            });
            expect(byNameId.some(project => project.id === testProject.id)).toBe(true);
        });

        test(`approvalQueueVersions returns queued/testing versions`, async () => {
            const response = await caller.internal.getThings.approvalQueueVersions({ gameName: `beatsaber` });
            expect(response.some(row => row.version.id === queueVersion.id)).toBe(true);
        });

        test(`generateDiff returns bad request when decompiled files do not exist`, async () => {
            const secondVersion = await createDummyVersion(testProject.id, testUser.id, undefined, {
                semver: new SemVer(`1.2.0`),
                status: Status.Private,
                lastUpdatedById: testUser.id,
            }).save();
            await secondVersion.$set(`supportedGameVersions`, [testGameVersion]);

            await expect(caller.internal.getThings.generateDiff({
                versionId1: testVersion.id,
                versionId2: secondVersion.id,
            })).rejects.toThrow();
        });

        test(`getFrontPageIcons returns featured/public content`, async () => {
            const response = await caller.internal.getThings.getFrontPageIcons();
            expect(response.length).toBeGreaterThan(0);
        });
    });

    describe(`updateThings`, () => {
        test(`asset.updateAsset updates editable fields`, async () => {
            await expect(caller.internal.updateThings.asset.updateAsset({
                id: testAsset.id,
                data: {
                    name: `Updated Internal Asset`,
                },
            })).resolves.not.toThrow();
        });

        test(`asset.submitAssetForApproval queues private assets`, async () => {
            const privateAsset = await createDummyAsset(testUser.id, undefined, {
                status: Status.Private,
                name: `Queue Candidate Asset`,
                fileHash: randomHash(),
            }).save();

            const response = await caller.internal.updateThings.asset.submitAssetForApproval({ id: privateAsset.id });
            expect(response.status).not.toBe(Status.Private);
        });

        test(`asset.addAssetLink and addAssetCollaborator create requests`, async () => {
            const linkResponse = await caller.internal.updateThings.asset.addAssetLink({
                id: testAsset.id,
                linkToId: otherAsset.id,
                type: LinkedAssetLinkType.Alternate,
            });
            expect([`Request created successfully`, `Asset linked successfully`]).toContain(linkResponse.message);

            const collabResponse = await caller.internal.updateThings.asset.addAssetCollaborator({
                id: testAsset.id,
                userId: otherUser.id,
            });
            expect(collabResponse.requestType).toBe(RequestType.Asset_Credit);
        });

        test(`project.updateProject updates mutable project fields`, async () => {
            const response = await caller.internal.updateThings.project.updateProject({
                id: testProject.id,
                data: {
                    summary: `Updated summary`,
                },
            });
            expect(response.summary).toBe(`Updated summary`);
        });

        test(`project.updateProjectIcon writes a new icon`, async () => {
            const form = new FormData();
            form.set(`projectId`, testProject.id.toString());
            form.set(`icon`, createPngFile(`project-icon.png`));

            const response = await caller.internal.updateThings.project.updateProjectIcon(form as any);
            expect(response.id).toBe(testProject.id);
            expect(response.iconFileUrl).toContain(`/`);
        });

        test(`version.updateVersion updates semver/dependencies/game versions`, async () => {
            const response = await caller.internal.updateThings.version.updateVersion({
                id: testVersion.id,
                data: {
                    semver: `2.0.0`,
                    dependencies: [],
                    supportedGameVersionIds: [testGameVersion.id],
                },
            });
            expect(response.semver).toBe(`2.0.0`);
        });

        test(`version.submitForApproval and removeFromQueue transition status`, async () => {
            const approvalCandidate = await createDummyVersion(testProject.id, testUser.id, undefined, {
                semver: new SemVer(`3.0.0`),
                status: Status.Private,
                lastUpdatedById: testUser.id,
            }).save();
            await approvalCandidate.$set(`supportedGameVersions`, [testGameVersion]);

            const queued = await caller.internal.updateThings.version.submitForApproval({ id: approvalCandidate.id });
            expect(queued.status).toBe(Status.Queue);

            const backToPrivate = await caller.internal.updateThings.version.removeFromQueue({ id: approvalCandidate.id });
            expect(backToPrivate.status).toBe(Status.Private);
        });

        test(`user.updateUser and toggleSecretFeatures update user profile/permissions`, async () => {
            const updated = await caller.internal.updateThings.user.updateUser({
                id: testUser.id,
                displayName: `Updated Display Name`,
                bio: `Updated Bio`,
            });
            expect(updated.displayName).toBe(`Updated Display Name`);

            await caller.internal.updateThings.user.toggleSecretFeatures({ enabled: true });
            await testUser.reload();
            expect(testUser.permissions.sitewide.includes(UserPermissions.Secret_Features)).toBe(true);

            await caller.internal.updateThings.user.toggleSecretFeatures({ enabled: false });
            await testUser.reload();
            expect(testUser.permissions.sitewide.includes(UserPermissions.Secret_Features)).toBe(false);
        });
    });

    describe(`translations`, () => {
        test(`createOrUpdateTranslationForProject creates and then updates entries`, async () => {
            const created = await caller.internal.translation.createOrUpdateTranslationForProject({
                id: testProject.id,
                language: `ja`,
                contentType: `summary`,
                translatedString: `ja-summary`,
            });
            expect(created.language).toBe(`ja`);

            const updated = await caller.internal.translation.createOrUpdateTranslationForProject({
                id: testProject.id,
                language: `ja`,
                contentType: `summary`,
                translatedString: `ja-summary-updated`,
            });
            expect(updated.translatedString).toBe(`ja-summary-updated`);
        });

        test(`getTranslationsForProject returns project translation rows`, async () => {
            const rows = await caller.internal.translation.getTranslationsForProject({ id: testProject.id });
            expect(rows.length).toBeGreaterThan(0);
            expect(rows.some(row => row.parentId === testProject.id)).toBe(true);
        });

        test(`translations show up when called via getMods with language param`, async () => {
            const updated = await caller.internal.translation.createOrUpdateTranslationForProject({
                id: testProject.id,
                language: `ja`,
                contentType: `description`,
                translatedString: `ja-description`,
            });
            const projectWithTranslation = await caller.v3.mods.getProjectAndVersions({ projectId: testProject.id, language: `ja` });
            expect(projectWithTranslation.project.translation?.description).toBe(`ja-description`);
        });
    });
});
