import { afterAll, beforeAll, describe, expect, inject, test } from "vitest";
import { Alert, AlertType, Asset, assetApiV3Schema, DatabaseManager, Status, User } from "../../src/shared/Database";
import { createDummyAsset, createDummyUser, handleException } from "../testTools";
import { createCaller } from "../../src/api/routers";

describe("trpc", () => {
    let databaseManager: DatabaseManager;
    let testAsset: Asset;
    let testUser: User;
    let caller = createCaller({
        userId: 12345,
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
            });

            test(`returns asset by id`, async () => {
                let response = await caller.v3.assets.getAssetById({ id: testAsset.id });
                expect(assetApiV3Schema.safeParse(response).success).toBe(true);
                expect(response.id).toEqual(testAsset.id);
            });
        });

        describe(`alerts`, async () => {
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

            describe(`getAlerts`, () => {
                test(`returns only read alerts`, async () => {
                    let response = await caller.internal.alerts.getMyAlerts({ read: `true` });
                    expect(response.length).toBeGreaterThan(0);
                    for (const alert of response) {                        
                        expect(alert.read).toBe(true);
                    }
                });

                test(`returns only unread alerts`, async () => {
                    let response = await caller.internal.alerts.getMyAlerts({ read: `false` });
                    expect(response.length).toBeGreaterThan(0);
                    for (const alert of response) {
                        expect(alert.read).toBe(false);
                    }
                });
            });
        })
    });
});