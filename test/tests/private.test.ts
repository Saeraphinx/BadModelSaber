import { init } from "../../src/index.ts";
import { EnvConfig } from "../../src/shared/EnvConfig.ts";
import supertest from "supertest";
import { Alert, AlertType, AssetFileFormat, License, Status, StatusHistory, Tags, User, UserInfer, UserRole } from "../../src/shared/Database.ts";
import { auth } from "../../src/api/RequestUtils.ts";
import { NextFunction, Request } from "express";
import { Op } from "sequelize";
import * as fs from "fs";
import { afterAll, beforeAll, describe, expect, test, vi } from "vitest";

let api = supertest(`http://localhost:8492/api`);
let user: User | undefined = undefined;

vi.mock(`../../src/api/RequestUtils.ts`, async () => {
    let original = await vi.importActual("../../src/api/RequestUtils.ts") as typeof import("../../src/api/RequestUtils.ts");
    return {
        ...original,
        auth: vi.fn().mockImplementation((requiredRole: UserRole[] | `loggedIn` | `any`, allowBanned = false) => {
            return (req: Request, res: Response, next: NextFunction) => {
                if (user) {
                    req.auth = {
                        isAuthed: true,
                        user: user
                    };
                } else {
                    req.auth = {
                        isAuthed: false,
                        user: undefined
                    };
                }
                next();
            }
        }),
    }
});

describe(`API Private`, () => {
    let server: Awaited<ReturnType<typeof init>>;
    beforeAll(async () => {
        process.env.PORT = `8492`;
        process.env.BASE_URL = `http://localhost:8492`;
        server = await init(`test_bms_request`);
        //await server.db.importFakeData();
        await server.db.Users.findOne({
            where: {
                roles: { [Op.contains]: [UserRole.Admin] }
            }
        }).then((foundUser) => {
            if (foundUser) {
                user = foundUser;
            } else {
                throw new Error(`No admin user found in test data`);
            }
        });
    }, 60000);

    afterAll(async () => {
        if (!server) {
            throw new Error(`Server was not initialized`);
        }
        await server.db.dropSchema();
        await server.stop();
    });

    test(`should initialize server`, () => {
        expect(server).toBeDefined();
    });

    describe.sequential(`Alerts`, async () => {
        let unreadAlert: Alert;
        let readAlert: Alert;
        beforeAll(async () => {
            unreadAlert = await server.db.Alerts.create({
                type: AlertType.AssetApproved,
                header: `Test Alert`,
                message: `This is a test alert`,
                userId: user!.id,
            });
    
            readAlert = await server.db.Alerts.create({
                type: AlertType.AssetRejected,
                header: `Read Alert`,
                message: `This is a read alert`,
                userId: user!.id,
                read: true,
            });
        })

        test(`should fetch alerts`, async () => {
            const res = await api.get(`/alerts`)
            expect(res.status, res.body.message).toBe(200);
            expect(res.body).toBeDefined();
            expect(res.body.length).toBe(1);
            expect(res.body[0]).toMatchObject(convertDatesToStrings(unreadAlert.toAPIResponse()));
        });

        test(`should fetch read alerts`, async () => {
            const res = await api.get(`/alerts`).query({ read: true });
            expect(res.status, res.body.message).toBe(200);
            expect(res.body).toBeDefined();
            expect(res.body.length).toBe(1);
            expect(res.body[0]).toMatchObject(convertDatesToStrings(readAlert.toAPIResponse()));
        });

        test(`should mark alert as read`, async () => {
            const res = await api.post(`/alerts/${unreadAlert.id}/read`);
            //console.log(readAlert.toJSON());
            await unreadAlert.reload();
            expect(res.status, res.body.message).toBe(200);
            expect(res.body).toMatchObject(convertDatesToStrings(unreadAlert.toAPIResponse()));
            expect(res.body.read).toBe(true);


            // double check the api response
            const checkRes = await api.get(`/alerts`);
            expect(checkRes.status, res.body.message).toBe(204);
        });

        test(`should delete alert`, async () => {
            const res = await api.delete(`/alerts/${readAlert.id}`);
            expect(res.status, res.body.message).toBe(204);

            // double check the api response
            const checkRes = await api.get(`/alerts`);
            if (checkRes.status !== 204) {
                expect(checkRes.body).toBeDefined();
                expect(checkRes.body).not.toContain(convertDatesToStrings(readAlert.toAPIResponse()));
            } else {
                expect(checkRes.status).toBe(204);
            }
        });
    });

    describe(`Approval`, () => {
        test(`should approve asset`, async () => {
            const asset = await server.db.Assets.create({
                name: `Test Asset`,
                description: `This is a test asset for approval`,
                fileHash: `testhash`,
                fileSize: 123456,
                iconNames: [`icon1.png`, `icon2.jpg`],
                type: AssetFileFormat.HSVConfig_JSON,
                status: Status.Pending,
                uploaderId: user!.id,
                license: License.CC0,
                tags: [Tags.Contest],
            });

            const res = await api.post(`/assets/${asset.id}/approval`).send({
                status: Status.Approved,
                reason: `Approved for testing`
            });
            
            expect(res.status, res.body.message).toBe(200);
            expect(res.body.asset).toBeDefined();
            expect(res.body.asset.id).toBe(asset.id);
            expect(res.body.asset.status).toBe(Status.Approved);

            // double check the asset status
            const checkAsset = await asset.reload();
            expect(checkAsset.status).toBe(Status.Approved);
            expect(res.body.asset).toMatchObject(convertDatesToStrings(await checkAsset.getApiV3Response()));
            expect(asset.statusHistory[0]).toBeDefined();
            expect(asset.statusHistory[0].status).toBe(Status.Approved);
            expect(asset.statusHistory[0].reason).toBe(`Approved for testing`);
            expect(asset.statusHistory[0].userId).toBe(user!.id);
        });
    });

    describe.skip(`Requests`, () => {
        
    });
});

function convertDatesToStrings(obj?: { [key: string]: any } & { createdAt?: Date, updatedAt?: Date, deletedAt?: Date|null }): { [key: string]: any } {
    if (!obj) return {};
    let newObj: { [key: string]: any } = {};
    for (let key in obj) {
        if (obj[key] instanceof Date) {
            newObj[key] = obj[key].toISOString();
        } else if (typeof obj[key] === `object`) {
            newObj[key] = convertDatesToStrings(obj[key]);
        } else {
            newObj[key] = obj[key];
        }
    }
    return newObj;
}