import { afterAll, beforeAll, describe, expect, inject, test } from "vitest";
import { Alert, Asset, AssetFileFormat, AssetInfer, ThingRequest, DatabaseManager, License, RequestType, Status, Tags, User, UserPermissions } from "../../src/shared/Database.ts";
import { createDummyAsset, createDummyUser, handleException } from "../testTools.ts";

describe("assets", () => {
    let databaseManager: DatabaseManager;
    let asset: Asset;
    let testUser: User;

    beforeAll(async () => {
        // @ts-ignore
        databaseManager = new DatabaseManager("test_assets", inject(`postgresUrl`));
        await databaseManager.init();

        testUser = await createDummyUser(12345).save();
        asset = await createDummyAsset(12345).save();
    });

    afterAll(async () => {
        await databaseManager.dropSchema().catch(console.error);
        await databaseManager.closeConnenction().catch(console.error);
    });


    describe("canView", () => {
        test(`true for verified & unverified assets`, async () => {
            asset.status = Status.Verified;
            expect(asset.canView(null)).toBe(true);
            asset.status = Status.Unverified;
            expect(asset.canView(null)).toBe(true);
        });

        test(`false for private assets`, async () => {
            asset.status = Status.Private;
            expect(asset.canView(null)).toBe(false);
        });

        test(`true for private assets if user is uploader`, async () => {
            asset.status = Status.Private;
            expect(asset.canView(testUser)).toBe(true);
        });

        test(`true for private assets if user is collaborator`, async () => {
            asset.status = Status.Private;
            asset.collaboratorIds = [...asset.collaboratorIds, testUser.id];
            await asset.save();
            expect(asset.canView(testUser)).toBe(true);
        });

        test(`true for private assets if user has Asset_ViewAll permission`, async () => {
            asset.status = Status.Private;
            expect(asset.canView(createDummyUser(4321, [UserPermissions.Asset_ViewAll]))).toBe(true);
        });
    });
    describe("canEdit", () => {
        test(`true for uploader`, async () => {
            expect(asset.canEdit(testUser)).toBe(true);
        });

        test(`false for other users`, async () => {
            expect(asset.canEdit(null)).toBe(false);
            expect(asset.canEdit(createDummyUser(4321))).toBe(false);
        });

        test(`true for Asset_EditAll`, async () => {
            expect(asset.canEdit(createDummyUser(9876, [UserPermissions.Asset_EditAll]))).toBe(true);
        });
    });
    describe(`updateAsset`, () => {
        test(`updates fields correctly`, async () => {
            let testAsset = await createDummyAsset(undefined, undefined, {
                name: "Unedited Test Asset",
                fileHash: "1234567890abcdesadf",
                tags: [Tags.Acc, Tags.Anime],
            }).save();
            await testAsset.updateAsset({
                name: "Edited Test Asset",
                description: "This is an edited test asset",
                tags: [Tags.Acc, Tags.Animations],
            }, createDummyUser(1234));

            await testAsset.reload();
            expect(testAsset.name).toBe("Edited Test Asset");
            expect(testAsset.description).toBe("This is an edited test asset");
            expect(testAsset.tags).toEqual([Tags.Acc, Tags.Animations]);
        });

        test(`throws error when using feature tags without permission`, async () => {
            let testAsset = await createDummyAsset().save();
            await expect(testAsset.updateAsset({
                tags: [Tags.Featured],
            }, createDummyUser(1234))).rejects.toThrowError();
        });

        test(`works with feature tags when user has permission`, async () => {
            let testAsset = await createDummyAsset(12345).save();
            await testAsset.updateAsset({
                tags: [Tags.Featured],
            }, createDummyUser(12345, [UserPermissions.Asset_InternalTags]));
            await testAsset.reload();
            expect(testAsset.tags).toEqual([Tags.Featured]);
        });
    });
    describe(`submitForApproval`, () => {
        test.for(getAssetTypes(false))(`sets status to Pending for format %s`, async (format) => {
            let testAsset = await createDummyAsset(undefined, undefined, {
                name: `test_${format}`,
                fileHash: `hash_${format}`,
                type: format,
                status: Status.Private,
            }).save();
            await testAsset.submitForApproval(testUser);
            await testAsset.reload();
            expect(testAsset.status).toBe(Status.Pending);
        });

        test.for(getAssetTypes(true))(`sets status to Unverified for format %s`, async (format) => {
            console.log(format);
            let testAsset = await createDummyAsset(undefined, undefined, {
                name: `test_${format}`,
                fileHash: `hash_${format}`,
                type: format,
                status: Status.Private,
            }).save();
            await testAsset.submitForApproval(testUser);
            await testAsset.reload();
            expect(testAsset.status).toBe(Status.Unverified);
        });
    })
    describe.sequential("requestCollab", () => {
        let uploader: User;
        let collaborator: User;
        let testAsset: Asset;
        beforeAll(async () => {
            try {
                uploader = await createDummyUser().save();
                collaborator = await createDummyUser().save();
                testAsset = await createDummyAsset(uploader.id, undefined, {
                    name: `Collab Test Asset`,
                    fileHash: `collab_test_hash`,
                }).save();
            } catch (error) {
                handleException(error)();
            }
        });


        test(`creates a collaboration request`, async () => {
            let request = await testAsset.requestCollab(uploader, collaborator);
            expect(request).toBeInstanceOf(ThingRequest);
            expect(request.requestType).toBe(RequestType.Asset_Credit);
            expect(request.refrencedId).toBe(testAsset.id);
            expect(request.requestResponseBy).toBe(collaborator.id);
            expect(request.requesterId).toBe(uploader.id);
        });

        test(`throws error when collaborator is already credited`, async () => {
            // first, add collaborator to asset
            testAsset.collaboratorIds = [...testAsset.collaboratorIds, collaborator.id];
            await testAsset.save();

            await expect(testAsset.requestCollab(uploader, collaborator)).rejects.toThrowError();
            await expect(testAsset.requestCollab(uploader, uploader)).rejects.toThrowError();
        });

        test(`does not create duplicate open requests`, async () => {
            await expect(testAsset.requestCollab(uploader, collaborator)).rejects.toThrowError();
        });

        test(`does not create request if request has already been denied`, async () => {
            let existingRequest = await ThingRequest.findOne({
                where: {
                    refrencedId: testAsset.id,
                    requestResponseBy: collaborator.id,
                    requestType: RequestType.Asset_Credit,
                }
            });
            if (!existingRequest) throw new Error(`Existing request not found`);
            existingRequest.accepted = false;
            await existingRequest.save();
            await expect(testAsset.requestCollab(uploader, collaborator)).rejects.toThrowError();
        });
    });
});

function getAssetTypes(shouldReturnAutoApproved: boolean): AssetFileFormat[] {
    const allTypes = Object.values(AssetFileFormat);
    const notAutoApproved = [
        AssetFileFormat.Avatar_Avatar,
        AssetFileFormat.Saber_Saber,
        AssetFileFormat.Platform_Plat,
        AssetFileFormat.Note_Bloq
    ];
    if (!shouldReturnAutoApproved) {
        return notAutoApproved;
    } else {
        return allTypes.filter(t => !notAutoApproved.includes(t));
    }
}