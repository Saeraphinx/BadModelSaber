import { afterAll, beforeAll, describe, expect, test, vi } from "vitest";
import { init } from "../../src/index.ts";
import { EnvConfig } from "../../src/shared/EnvConfig";
import supertest from "supertest";
import { Asset, AssetFileFormat, License, Status, Tags, User, UserInfer, UserRole } from "../../src/shared/Database.ts";
import { auth } from "../../src/api/RequestUtils.ts";
import { NextFunction, Request } from "express";
import { Op } from "sequelize";
import * as fs from "fs";

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
        process.env.PORT = `8491`;
        process.env.BASE_URL = `http://localhost:8491`;
        server = await init(`test_bms_apiv3`);
        await server.db.importFakeData();
        await User.findOne({
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
        if (!server || !server.app || !server.server) {
            throw new Error(`Server did not initialize correctly`);
        }
    });

    test.each(generateAssetFilterTestCases())('/assets filter (%s, %s)', async (type, status) => {
        let res = await api_v3.get(`/assets`)
            .query({
                type: type,
                status: status
            });
        expect(res.statusCode, res.body.message).toBe(200);
        expect(res.body).toHaveProperty(`assets`);
        expect(res.body.assets).toBeInstanceOf(Array);
        for (let asset of res.body.assets) {
            expect(asset).toHaveProperty(`id`);
            expect(asset).toHaveProperty(`type`);
            expect(asset).toHaveProperty(`status`);
            if (type) {
                expect(asset.type).toBe(type);
            }
            if (status) {
                expect(asset.status).toBe(status);
            }
        }
    });

    test(`/users/me should return current user`, async () => {
        let res = await api_v3.get(`/users/me`);
        expect(res.statusCode, res.body.message).toBe(200);
        expect(res.body).toMatchObject(user?.getApiResponse() ?? {});
    });

    test(`/users/:id should return user by ID`, async () => {
        if (!user) {
            throw new Error(`User is not defined`);
        }
        let res = await api_v3.get(`/users/${user.id}`);
        expect(res.statusCode, res.body.message).toBe(200);
        expect(res.body).toMatchObject(user.getApiResponse());
    });

    test(`/users/:id/assets should return assets for user`, async () => {
        if (!user) {
            throw new Error(`User is not defined`);
        }
        let res = await api_v3.get(`/users/${user.id}/assets`);
        expect(res.statusCode, res.body.message).toBe(200);
        expect(res.body).toHaveProperty(`assets`);
        expect(res.body.assets).toBeInstanceOf(Array);
        for (let asset of res.body.assets) {
            let isUploader = asset.uploader.id === user.id;
            let isCredited = asset.collaborators.some((credit: any) => credit === user?.id);
            expect(isUploader || isCredited, `Asset ${asset.id} should be uploaded by ${user.id} or credited to the user`).toBe(true,);
        }
    });

    test(`/upload should upload an asset`, async () => {
        if (!user) {
            throw new Error(`User is not defined`);
        }
        let res = await api_v3.post(`/assets/upload`)
            .attach(`asset`, `./test/assets/icon5.png`)
            .field(`data`, JSON.stringify({
                name: `Test Asset`,
                description: `This is a test asset`,
                type: AssetFileFormat.Banner_Png,
                license: License.CC0,
                licenseUrl: null,
                sourceUrl: null,
                tags: [Tags.Pride, Tags.Contest],
            }))
            .attach(`icon_1`, `./test/assets/icon1.png`)
            .attach(`icon_2`, `./test/assets/icon2.jpg`)
        //console.log(res);
        expect(res.statusCode, res.body.message).toBe(201);
        expect(res.body).toHaveProperty(`message`, `Asset created successfully.`);
        expect(res.body.asset).toHaveProperty(`name`, `Test Asset`);
        let asset = await Asset.findByPk(res.body.asset.id);
        expect(asset).toBeDefined();
        expect(res.body.asset).toMatchObject(convertDatesToStrings(await asset?.getApiV3Response()) ?? {});
        expect(fs.existsSync(`./test/temp/uploads/${asset?.fileName}`)).toBe(true);
        expect(fs.existsSync(`./test/temp/icons/${asset?.iconNames[0]}`)).toBe(true);
        expect(fs.existsSync(`./test/temp/icons/${asset?.iconNames[1]}`)).toBe(true);
        expect(asset?.status).toBe(Status.Private);
    })
});

function generateAssetFilterTestCases() {
    let arr: (string | undefined)[][] = [];
    for (let fileFormat of Object.values(AssetFileFormat)) {
        for (let status of Object.values(Status)) {
            arr.push([fileFormat, status]);
        }
    }

    return arr;
}

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