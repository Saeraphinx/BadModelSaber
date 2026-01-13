import { afterAll, beforeAll, describe, expect, inject, test } from "vitest";
import { Context } from "../../src/api/trpc.ts";
import { createCaller } from "../../src/api/routers.ts";
import { Alert, Asset, AssetFileFormat, AssetInfer, AssetRequest, DatabaseManager, License, RequestType, Status, Tags, User, UserPermissions } from "../../src/shared/Database.ts";
import { CreationAttributes, InferCreationAttributes } from "sequelize";
import { before } from "node:test";

// most endpoints don't actually need a fully functional context, so we can just kinda do this
function createTestContext(userId: string): Context {
    return {
        req: {} as any,
        res: {} as any,
        userId: userId,
        db: {} as any,
    };
}

function createDummyUser(id: string, roles: UserPermissions[] = []): User {
    return {
        id: id,
        roles: roles,
    } as User;
}

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
        let assetDefaults: Omit<CreationAttributes<Asset>, `name` | `fileHash`>;
        let testUser: User;
        beforeAll(async () => {
            assetDefaults = {
                type: AssetFileFormat.Avatar_Avatar,
                description: "This is a test asset",
                license: License.CC0,
                tags: [],
                fileSize: 1,
                uploaderId: "1234",
                fileSafeName: "test_asset.avatar",
                iconNames: ["icon1.png", "icon2.png"],
            }
            testUser = await User.create({
                id: "1234",
                username: "testuser",
                displayName: "Test User",
                avatarUrl: "",
                roles: [],
            });
            asset = await Asset.create({
                ...assetDefaults,
                name: "Test Asset",
                fileHash: "abcdef1234567890",
            });
        });

        test(`canEdit returns true for uploader`, async () => {
            expect(asset.canEdit(createDummyUser(`1234`))).toBe(true);
        });

        test(`canEdit returns false for other users`, async () => {
            expect(asset.canEdit(null)).toBe(false);
            expect(asset.canEdit(createDummyUser(`4321`))).toBe(false);
        });

        test(`canEdit returns true for edit_any_asset`, async () => {
            expect(asset.canEdit(createDummyUser(`9876`, [UserPermissions.Edit_Any_Asset]))).toBe(true);
        });

        test(`updateAsset updates fields correctly`, async () => {
            let testAsset = await Asset.create({
                ...assetDefaults,
                name: "Unedited Test Asset",
                fileHash: "1234567890abcdesadf",
                tags: [Tags.Acc, Tags.Anime],
            });
            await testAsset.updateAsset({
                name: "Edited Test Asset",
                description: "This is an edited test asset",
                tags: [Tags.Acc, Tags.Animations],
            }, createDummyUser(`1234`));

            await testAsset.reload();
            expect(testAsset.name).toBe("Edited Test Asset");
            expect(testAsset.description).toBe("This is an edited test asset");
            expect(testAsset.tags).toEqual([Tags.Acc, Tags.Animations]);
        })

        test(`updateAsset throws error when using feature tags without permission`, async () => {
            let testAsset = await Asset.create({
                ...assetDefaults,
                name: "Unedited Test Asset 2",
                fileHash: "zxcvbnmasdfghjkl",
            });
            await expect(testAsset.updateAsset({
                tags: [Tags.Featured],
            }, createDummyUser(`1234`))).rejects.toThrowError();
        });

        test(`updateAsset works with feature tags when user has permission`, async () => {
            let testAsset = await Asset.create({
                ...assetDefaults,
                name: "Unedited Test Asset 3",
                fileHash: "poiuytrewqlkjhgf",
            });
            await testAsset.updateAsset({
                tags: [Tags.Featured],
            }, createDummyUser(`1234`, [UserPermissions.Allow_Internal_Tags]));
            await testAsset.reload();
            expect(testAsset.tags).toEqual([Tags.Featured]);
        });

        test.for(getAssetTypes(false))(`submitForApproval sets status to Pending for format %s`, async (format) => {
            let testAsset = await Asset.create({
                ...assetDefaults,
                name: `test_${format}`,
                fileHash: `hash_${format}`,
                type: format,
                status: Status.Private,
            });
            await testAsset.submitForApproval(testUser);
            await testAsset.reload();
            expect(testAsset.status).toBe(Status.Pending);
        });

        test.for(getAssetTypes(true))(`submitForApproval sets status to Unverified format %s`, async (format) => {
            console.log(format);
            let testAsset = await Asset.create({
                ...assetDefaults,
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
                uploader = await User.create({
                    id: "uploader1",
                    username: "uploader",
                });
                collaborator = await User.create({
                    id: "collab1",
                    username: "collaborator",
                });
                testAsset = await Asset.create({
                    ...assetDefaults,
                    name: `Collab Test Asset`,
                    fileHash: `collab_test_hash`,
                    uploaderId: uploader.id,
                });
            });


            test(`requestCollab creates a collaboration request`, async () => {
                let request = await testAsset.requestCollab(uploader, collaborator);
                expect(request).toBeInstanceOf(AssetRequest);
                expect(request.requestType).toBe(RequestType.Credit);
                expect(request.refrencedAssetId).toBe(testAsset.id);
                expect(request.requestResponseBy).toBe(collaborator.id);
                expect(request.requesterId).toBe(uploader.id);
            });

            test(`requestCollab throws error when collaborator is already credited`, async () => {
                // first, add collaborator to asset
                testAsset.collaborators = [...testAsset.collaborators, collaborator.id];
                await testAsset.save();
                
                expect(testAsset.requestCollab(uploader, collaborator)).rejects.toThrowError();
                expect(testAsset.requestCollab(uploader, uploader)).rejects.toThrowError();
            });

            test(`requestCollab does not create duplicate open requests`, async () => {
                expect(testAsset.requestCollab(uploader, collaborator)).rejects.toThrowError();
            });

            test(`requestCollab does not create request if request has already been denied`, async () => {
                let existingRequest = await AssetRequest.findOne({
                    where: {
                        refrencedAssetId: testAsset.id,
                        requestResponseBy: collaborator.id,
                        requestType: RequestType.Credit,
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