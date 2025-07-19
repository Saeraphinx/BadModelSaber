import { afterAll, beforeAll, describe, expect, test, vi } from "vitest";
import { init } from "../../src/index.ts";
import { EnvConfig } from "../../src/shared/EnvConfig";
import supertest from "supertest";
import { AssetFileFormat, AssetType, Status, User, UserInfer, UserRole } from "../../src/shared/Database.ts";
import { auth } from "../../src/api/RequestUtils.ts";
import { NextFunction, Request } from "express";
import { Op } from "sequelize";

let api_v3 = supertest(`http://localhost:8491/api/v3`);
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

describe(`API v3`, () => {
    let server: Awaited<ReturnType<typeof init>>;
    beforeAll(async () => {

        server = await init(`test_bms_apiv3`);
        await server.db.importFakeData();
        //let allUsers = await server.db.Users.findAll();
        //console.log(allUsers.map(u => u.toJSON()));
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
        if (server.server.listening) {
            server.server.close();
        }
        await server.db.dropSchema();
        await server.db.closeConnenction();
    });

    test(`should initialize server`, () => {
        if (!server || !server.app || !server.server) {
            throw new Error(`Server did not initialize correctly`);
        }
    });

    test.each(generateAssetFilterTestCases())('/assets filter (%s, %s, %s, %s', async (type, fileFormat, status, tags) => {

        let res = await api_v3.get(`/assets`)
            .query({
                type: type,
                fileFormat: fileFormat,
                status: status,
                tags: tags,
            });
        expect(res.statusCode, res.body.message).toBe(200);
        expect(res.body).toHaveProperty(`assets`);
        expect(res.body.assets).toBeInstanceOf(Array);
        for (let asset of res.body.assets) {
            expect(asset).toHaveProperty(`id`);
            expect(asset).toHaveProperty(`type`);
            expect(asset).toHaveProperty(`fileFormat`);
            expect(asset).toHaveProperty(`status`);
            if (type) {
                expect(asset.type).toBe(type);
            }
            if (fileFormat) {
                expect(asset.fileFormat).toBe(fileFormat);
            }
            if (status) {
                expect(asset.status).toBe(status);
            }
        }
    });
});

function generateAssetFilterTestCases() {
    let arr: (string | undefined)[][] = [];
    for (let type of Object.values(AssetType)) {
        for (let fileFormat of Object.values(AssetFileFormat)) {
            for (let status of Object.values(Status)) {
                arr.push([type, fileFormat, status, undefined, undefined, undefined]);
            }
        }
    }
    return arr;
}