import { afterAll, beforeAll, describe, expect, test } from "vitest";
import { Context } from "../../src/api/trpc.ts";
import { createCaller } from "../../src/api/routers.ts";
import { Asset, AssetFileFormat, DatabaseManager, License } from "../../src/shared/Database.ts";
import { EnvConfig } from "../../src/shared/EnvConfig.ts";
import { PostgreSqlContainer, StartedPostgreSqlContainer } from "@testcontainers/postgresql";

// most endpoints don't actually need a fully functional context, so we can just kinda do this
function createTestContext(userId: string): Context {
    return {
        req: {} as any,
        res: {} as any,
        userId: userId,
        db: {} as any,
    };
}


describe("database tests", () => {
    let databaseManager: DatabaseManager;
    let postgresContainer: StartedPostgreSqlContainer;
    
    beforeAll(async () => {
        postgresContainer = await new PostgreSqlContainer("postgres:17").start();
        //console.log(`Postgres container started at ${postgresContainer.getConnectionUri()}`);
        databaseManager = new DatabaseManager("test_trpc", postgresContainer.getConnectionUri());
        await databaseManager.init();
    });

    afterAll(async () => {
        await databaseManager.closeConnenction().catch(console.error);
        await postgresContainer.stop().catch(console.error);
    });

    describe("assets", () => {
        let testAsset = new Asset({
                type: AssetFileFormat.Avatar_Avatar,
                name: "Test Asset",
                description: "This is a test asset",
                fileHash: "somehashvalue",
                fileSafeName: "somefilename",
                fileSize: 12345,
                iconNames: ["icon1", "icon2"],
                license: License.CC0,
                uploaderId: "5",

            });
        test(`canView`, () => {
            
        })
    });
});