import { init } from "../../src/index.ts";
import { EnvConfig } from "../../src/shared/EnvConfig.ts";
import supertest from "supertest";
import { Alert, AlertType, AssetFileFormat, License, Status, Tags, User, UserInfer, UserRole } from "../../src/shared/Database.ts";
import { auth } from "../../src/api/RequestUtils.ts";
import { NextFunction, Request } from "express";
import { Op } from "sequelize";
import * as fs from "fs";
import { afterAll, beforeAll, describe, expect, test, vi } from "vitest";

let api_v3 = supertest(`http://localhost:8492/api/v3`);
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
            const res = await api_v3.get(`/alerts`)
            expect(res.status).toBe(200);
            expect(res.body).toBeDefined();
            expect(res.body.length).toBe(1);
            expect(res.body[0]).toMatchObject(unreadAlert.toAPIResponse());
        });

        test(`should fetch read alerts`, async () => {
            const res = await api_v3.get(`/alerts`).query({ read: true });
            expect(res.status).toBe(200);
            expect(res.body).toBeDefined();
            expect(res.body.length).toBe(1);
            expect(res.body[0]).toMatchObject(readAlert.toAPIResponse());
        });

        test(`should mark alert as read`, async () => {
            const res = await api_v3.post(`/alerts/${unreadAlert.id}/read`);
            expect(res.status).toBe(200);
            expect(res.body).toMatchObject(unreadAlert.toAPIResponse());
            expect(res.body.read).toBe(true);


            // double check the api response
            const checkRes = await api_v3.get(`/alerts`);
            expect(checkRes.status).toBe(204);
        });

        test(`should delete alert`, async () => {
            const res = await api_v3.delete(`/alerts/${readAlert.id}`);
            expect(res.status).toBe(200);

            // double check the api response
            const checkRes = await api_v3.get(`/alerts`);
            expect(checkRes.status).toBe(204);
        });
    });
});