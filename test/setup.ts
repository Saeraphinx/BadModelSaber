import { beforeAll, beforeEach, vi } from "vitest";
import * as fs from "fs";
import { generateFakeData } from "./generateFakeData.ts";
import path from "path";

vi.mock(`../src/api/routes/public/all/auth.ts`, async (original) => {
    return {
        AuthRoutes: {
            loadRoutes: (router: any) => {
                // do nothing
            }
        }
    };
});



process.env.NODE_ENV = `test`;

if (!fs.existsSync(`./storage/fakeData.json`)) {
    console.log(`No test data found, generating fake data...`);
    await generateFakeData().then(() => {
        console.log(`Fake data generated.`);
    }).catch(err => {
        console.error(`Error generating fake data:`, err);
    });
}