import { afterAll, beforeAll, describe, expect, inject, test } from "vitest";
import { Alert, AlertType, Asset, assetApiV3Schema, DatabaseManager, Status, Tags, User } from "../../src/shared/Database";
import { createDummyAsset, createDummyUser, handleException } from "../testTools";
import { createCaller } from "../../src/api/routers";

describe("trpc", () => {
    let databaseManager: DatabaseManager;
    let testAsset: Asset;
    let testUser: User;
    let caller = createCaller({
        userId: 123456,
        req: {} as any,
        res: {} as any,
        db: {} as any,
    })

    beforeAll(async () => {
        // @ts-ignore
        databaseManager = new DatabaseManager("test_trpc", inject(`postgresUrl`));
        await databaseManager.init();
        await databaseManager.importFakeData();

        try {
            testUser = await createDummyUser(123456).save();
            testAsset = await createDummyAsset(123456, undefined, {
                status: Status.Verified
            }).save();
        } catch (error) {
            console.error(`Error setting up test data:`, error);
            handleException(error)();
        }
    });

    afterAll(async () => {
        await databaseManager.dropSchema().catch(console.error);
        await databaseManager.closeConnenction().catch(console.error);
    });

    test(`status`, async () => {
        let status = await caller.internal.status.status();
        expect(status).toHaveProperty(`message`, `Server is running`);
        expect(status).toHaveProperty(`timestamp`);
        expect(status).toHaveProperty(`isDocker`);
        expect(status).toHaveProperty(`environment`);
        expect(status).toHaveProperty(`version`);
    });

    describe(`v3`, () => {
        describe(`getAsset`, () => {
            describe(`getAssets`, () => {
                test(`returns assets`, async () => {
                    let response = await caller.v3.assets.getAssets({});
                    expect(response.assets.length).toBeGreaterThan(0);
                    expect(response.total).toEqual(response.assets.length);
                    for (const asset of response.assets) {
                        expect(assetApiV3Schema.safeParse(asset).success).toBe(true);
                    }
                });

                // test pagination
                test(`pagination works`, async () => {
                    let response = await caller.v3.assets.getAssets({ limit: 1, page: 1 });
                    expect(response.assets.length).toEqual(1);
                    expect(response.total).toBeGreaterThan(1);
                    for (const asset of response.assets) {
                        expect(assetApiV3Schema.safeParse(asset).success).toBe(true);
                    }
                    let response2 = await caller.v3.assets.getAssets({ limit: 1, page: 2 });
                    expect(response2.assets.length).toEqual(1);
                    expect(response2.total).toEqual(response.total);
                    for (const asset of response2.assets) {
                        expect(assetApiV3Schema.safeParse(asset).success).toBe(true);
                    }
                    expect(response.assets[0].id).not.toEqual(response2.assets[0].id);
                });

                // test filtering by tags
                test(`filtering by tags works`, async () => {
                    // add a tag to the test asset
                    testAsset.tags = [Tags.Featured];
                    await testAsset.save();
                    let response = await caller.v3.assets.getAssets({ tags: [Tags.Featured] });
                    expect(response.assets.length).toBeGreaterThan(0);
                    let foundTestAsset = false;
                    for (const asset of response.assets) {
                        expect(asset.tags).toContain(Tags.Featured);
                        if (asset.id === testAsset.id) {
                            foundTestAsset = true;
                        }
                    }
                    expect(foundTestAsset).toBe(true);
                });
            });

            test(`returns asset by id`, async () => {
                let response = await caller.v3.assets.getAssetById({ id: testAsset.id });
                expect(assetApiV3Schema.safeParse(response).success).toBe(true);
                expect(response.id).toEqual(testAsset.id);
            });
        });

        describe.sequential(`alerts`, async () => {
            let unreadAlert: Alert;
            let readAlert: Alert;
            beforeAll(async () => {
                unreadAlert = await testUser.createAlert({
                    type: AlertType.Generic,
                    message: `This is a unread test alert`,
                    header: `Unread Alert`,
                });

                readAlert = await testUser.createAlert({
                    type: AlertType.Generic,
                    message: `This is a read test alert`,
                    header: `Read Alert`,
                })
                readAlert.read = true;
                await readAlert.save();
            });

            test(`getAlerts returns only read alerts`, async () => {
                let response = await caller.internal.alerts.getAlerts({ read: `true` });
                expect(response.length).toBeGreaterThan(0);
                for (const alert of response) {
                    expect(alert.read).toBe(true);
                }
            });

            test(`getAlerts returns only unread alerts`, async () => {
                let response = await caller.internal.alerts.getAlerts({ read: `false` });
                expect(response.length).toBeGreaterThan(0);
                for (const alert of response) {
                    expect(alert.read).toBe(false);
                }
            });

            test(`markAlertRead marks alert as read`, async () => {
                let response = await caller.internal.alerts.markAlertRead({ id: unreadAlert.id });
                expect(response.read).toBe(true);
                await unreadAlert.reload();
                expect(unreadAlert.read).toBe(true);
            });

            test(`markAlertRead throws error when marking someone else's alert`, async () => {
                let otherUser = await createDummyUser().save();
                let otherAlert = await otherUser.createAlert({
                    type: AlertType.Generic,
                    message: `This is another user's alert`,
                    header: `Other User Alert`,
                });
                await expect(caller.internal.alerts.markAlertRead({ id: otherAlert.id })).rejects.toThrowError();
            });

            // alerts are NOT paranoid
            test(`deleteAlert deletes alert`, async () => {
                await caller.internal.alerts.deleteAlert({ id: readAlert.id });
                let deletedAlert = await Alert.findByPk(readAlert.id);
                expect(deletedAlert).toBeNull();
            });

            test(`deleteAlert throws error when deleting someone else's alert`, async () => {
                let otherUser = await createDummyUser().save();
                let otherAlert = await otherUser.createAlert({
                    type: AlertType.Generic,
                    message: `This is another user's alert`,
                    header: `Other User Alert`,
                });
                await expect(caller.internal.alerts.deleteAlert({ id: otherAlert.id })).rejects.toThrowError();
            });
        })
    });
});