import * as fs from "fs";
import { generateFakeData } from "./generateFakeData.ts";
import { EnvConfig } from "../src/shared/EnvConfig.ts";
import { PostgreSqlContainer } from "@testcontainers/postgresql";
import { TestProject } from "vitest/node";

export default async function setup(project: TestProject) {
    console.log(`Setting up global test environment...`);
    EnvConfig.load();
    process.env.NODE_ENV = `test`;
    process.env.STORAGE_UPLOADS="./test/temp/uploads"
    process.env.STORAGE_ICONS="./test/temp/icons"
    process.env.STORAGE_LOGS="./test/temp/logs"

    console.log(`Starting PostgreSQL container...`);
    let postgresContainer = await new PostgreSqlContainer("postgres:17").start();
    console.log(`Postgres container started at ${postgresContainer.getConnectionUri()}`);
    // @ts-ignore
    project.provide(`postgresUrl`, postgresContainer.getConnectionUri());

    if (!fs.existsSync(`./storage/fakeData.json`)) {
        console.log(`No test data found, generating fake data...`);
        await generateFakeData(postgresContainer.getConnectionUri()).then(() => {
            console.log(`Fake data generated.`);
        }).catch(err => {
            console.error(`Error generating fake data:`, err);
            process.exit(4234);
        });
        await postgresContainer.restart();
    }

    project.onTestsRerun(async () => {
        await postgresContainer.restart();
        // @ts-ignore
        project.provide(`postgresUrl`, postgresContainer.getConnectionUri());
        console.log(`Postgres container restarted & available at ${postgresContainer.getConnectionUri()}`);
        if (fs.existsSync(`./test/temp`)) {
            fs.rmSync(`./test/temp`, { recursive: true, force: true });
            console.log(`Temporary test files cleaned up.`);
        }
    });

    return async () => {
        await postgresContainer.stop();
        if (fs.existsSync(`./test/temp`)) {
            fs.rmSync(`./test/temp`, { recursive: true, force: true });
            console.log(`Temporary test files cleaned up.`);
        }
    }
}

// @ts-ignore
declare module 'vitest' {
    export interface ProvidedContext {
        postgresUrl: string;
    }
}
export {};