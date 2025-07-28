import * as fs from "fs";
import { generateFakeData } from "./generateFakeData.ts";
import path from "path";

export default async function () {
    process.env.NODE_ENV = `test`;
    process.env.STORAGE_UPLOADS="./test/temp/uploads"
    process.env.STORAGE_ICONS="./test/temp/icons"
    process.env.STORAGE_LOGS="./test/temp/logs"
    if (!fs.existsSync(`./storage/fakeData.json`)) {
        console.log(`No test data found, generating fake data...`);
        await generateFakeData().then(() => {
            console.log(`Fake data generated.`);
        }).catch(err => {
            console.error(`Error generating fake data:`, err);
        });
    }

    return () => {
        if (fs.existsSync(`./test/temp`)) {
            fs.rmSync(`./test/temp`, { recursive: true, force: true });
            console.log(`Temporary test files cleaned up.`);
        }
    }
}