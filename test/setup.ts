import { log } from "console";
import { beforeAll, beforeEach, vi } from "vitest";
import { Logger } from "../src/shared/Logger.ts";
import { EnvConfig } from "../src/shared/EnvConfig.ts";
import * as fs from "fs";
import { DatabaseManager } from "../src/shared/Database.ts";
import { generateFakeData } from "./generateFakeData.ts";

vi.mock(`../src/api/routes/public/all/auth.ts`, async (original) => {
    return {
        AuthRoutes: {
            loadRoutes: (router: any) => {
                // do nothing
            }
        }
    };
});

async function setupTestData() {
    if (!fs.existsSync(`./test/testData.json`)) {
        console.log(`Test data file not found, copying form db file...`);
        if (!fs.existsSync(`./test/test.sqlite`)) {
            console.log(`Test database file not found, generating...`);
            await generateFakeData();
        }
        let db = new DatabaseManager(`./test/test.sqlite`);
        await db.init().then(async () => {
            console.log(`Test database initialized.`);
            let data = await db.export()
            fs.writeFileSync(`./test/testData.json`, JSON.stringify(data, null, 0));
        }).catch(err => {
            console.error(`Error initializing test database: ${err}`);
        });
    }
}

await setupTestData();

process.env.NODE_ENV = `test`;
process.env.PORT = `8491`;
process.env.BASE_URL = `http://localhost:8491`;
process.env.DB_DIALECT = `sqlite`;
process.env.DB_CONNECTION_STRING = `:memory:`;
