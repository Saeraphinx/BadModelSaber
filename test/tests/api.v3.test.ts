import { afterAll, beforeAll, describe, expect, test } from "vitest";
import { init } from "../../src/index.ts";
import { EnvConfig } from "../../src/shared/EnvConfig";
import supertest from "supertest";

let api_v3 = supertest(`http://localhost:8491/api/v3`);

describe(`API v3`, () => {
    let server: Awaited<ReturnType<typeof init>>;
    beforeAll(async () => {
        server = await init();
        console.log(JSON.stringify(EnvConfig));
    });

    afterAll(async () => {
        if (server.server.listening) {
            server.server.close();
        }

        server.db.closeConnenction();
    });

    test(`should initialize server`, () => {
        if (!server || !server.app || !server.server) {
            throw new Error(`Server did not initialize correctly`);
        }
    });

    test(`get /v3/assets should return 200`, async () => {
        const response = await api_v3.get(`/assets`);
        expect(response.status, response.body.message).toBe(200);
    });
});