import { afterAll, beforeAll, describe, expect, inject, test } from "vitest";
import { Context } from "../../src/api/trpc.ts";
import { Alert, Asset, AssetFileFormat, AssetInfer, ThingRequest, DatabaseManager, License, RequestType, Status, Tags, User, UserPermissions } from "../../src/shared/Database.ts";
import { CreationAttributes, InferCreationAttributes } from "sequelize";
import { createDummyAsset, createDummyUser } from "../testTools.ts";

describe("database tests", () => {
    let databaseManager: DatabaseManager;

    beforeAll(async () => {
        // @ts-ignore
        databaseManager = new DatabaseManager("test_assets", inject(`postgresUrl`));
        await databaseManager.init();
    });

    afterAll(async () => {
        await databaseManager.dropSchema().catch(console.error);
        await databaseManager.closeConnenction().catch(console.error);
    });

    describe("assets", () => {
        let asset: Asset;
        let testUser: User;
        beforeAll(async () => {
            testUser = await createDummyUser(12345).save();
            asset = await createDummyAsset(12345).save();
        });

        test(`canEdit returns true for uploader`, async () => {
            expect(asset.canEdit(testUser)).toBe(true);
        });

        test(`canEdit returns false for other users`, async () => {
            expect(asset.canEdit(null)).toBe(false);
            expect(asset.canEdit(createDummyUser(4321))).toBe(false);
        });

        test(`canEdit returns true for Asset_EditAll`, async () => {
            expect(asset.canEdit(createDummyUser(9876, [UserPermissions.Asset_EditAll]))).toBe(true);
        });

        test(`updateAsset updates fields correctly`, async () => {
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
        })

        test(`updateAsset throws error when using feature tags without permission`, async () => {
            let testAsset = await createDummyAsset().save();
            await expect(testAsset.updateAsset({
                tags: [Tags.Featured],
            }, createDummyUser(1234))).rejects.toThrowError();
        });

        test(`updateAsset works with feature tags when user has permission`, async () => {
            let testAsset = await createDummyAsset(12345).save();
            await testAsset.updateAsset({
                tags: [Tags.Featured],
            }, createDummyUser(12345, [UserPermissions.Asset_InternalTags]));
            await testAsset.reload();
            expect(testAsset.tags).toEqual([Tags.Featured]);
        });

        test.for(getAssetTypes(false))(`submitForApproval sets status to Pending for format %s`, async (format) => {
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

        test.for(getAssetTypes(true))(`submitForApproval sets status to Unverified format %s`, async (format) => {
            console.log(format);
            let testAsset = await createDummyAsset(undefined, undefined, {
                name: `test_${format}`,
                fileHash: `hash_${format}`,
                type: format,
                status: Status.Private,
            });
            await testAsset.submitForApproval(testUser);
            await testAsset.reload();
            expect(testAsset.status).toBe(Status.Unverified);
        });

        describe.sequential("collabs", () => {
            let uploader: User;
            let collaborator: User;
            let testAsset: Asset;
            beforeAll(async () => {
                uploader = await createDummyUser().save();
                collaborator = await createDummyUser().save();
                testAsset = await createDummyAsset(uploader.id, undefined, {
                    name: `Collab Test Asset`,
                    fileHash: `collab_test_hash`,
                }).save();
            });


            test(`requestCollab creates a collaboration request`, async () => {
                let request = await testAsset.requestCollab(uploader, collaborator);
                expect(request).toBeInstanceOf(ThingRequest);
                expect(request.requestType).toBe(RequestType.Asset_Credit);
                expect(request.refrencedId).toBe(testAsset.id);
                expect(request.requestResponseBy).toBe(collaborator.id);
                expect(request.requesterId).toBe(uploader.id);
            });

            test(`requestCollab throws error when collaborator is already credited`, async () => {
                // first, add collaborator to asset
                testAsset.collaboratorIds = [...testAsset.collaboratorIds, collaborator.id];
                await testAsset.save();
                
                expect(testAsset.requestCollab(uploader, collaborator)).rejects.toThrowError();
                expect(testAsset.requestCollab(uploader, uploader)).rejects.toThrowError();
            });

            test(`requestCollab does not create duplicate open requests`, async () => {
                expect(testAsset.requestCollab(uploader, collaborator)).rejects.toThrowError();
            });

            test(`requestCollab does not create request if request has already been denied`, async () => {
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
                expect(testAsset.requestCollab(uploader, collaborator)).rejects.toThrowError();
            });
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