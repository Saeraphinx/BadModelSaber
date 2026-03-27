import { afterAll, beforeAll, describe, expect, test, inject } from "vitest";
import { DatabaseManager, Asset, Alert, AlertType, Game, User, GameVersion, Project } from "../../src/shared/Database";
import { createDummyUser, createDummyAsset, createDummyProject } from "../testTools";

describe("database", () => {
    let databaseManager: DatabaseManager;
    let testUser: User;
    let testAsset: Asset;
    let testGame: Game;
    let testGameVersion: GameVersion;

    beforeAll(async () => {
        // @ts-ignore
        databaseManager = new DatabaseManager("test_database", inject(`postgresUrl`));
        await databaseManager.init();
        testUser = await createDummyUser().save();
        testAsset = await createDummyAsset(testUser.id).save();
        testGame = await Game.create({
            name: "test_game",
            default: false,
            displayName: "Test Game",
            webhookConfig: []
        });
        testGameVersion = await GameVersion.create({
            version: "1.0.0",
            gameName: testGame.name
        });
    });

    afterAll(async () => {
        await databaseManager.dropSchema().catch(console.error);
        await databaseManager.closeConnenction().catch(console.error);
    });

    describe("tables", () => {
        test("alert properties are saved and retrieved correctly", async () => {
            const alert = await Alert.create({
                header: "test",
                message: "test",
                type: AlertType.Generic,
                userId: testUser.id,
            });
            const retrievedAlert = await Alert.findOne({ where: { id: alert.id } });

            for (const key in alert.dataValues) {
                expect(retrievedAlert).toHaveProperty(key);
                expect(retrievedAlert?.[(key as keyof Alert)]).toEqual(alert[(key as keyof Alert)]);
            }
        });

        test("asset properties are saved and retrieved correctly", async () => {
            const testAsset = await createDummyAsset(testUser.id).save();
            const retrievedAsset = await Asset.findOne({ where: { id: testAsset.id } });

            for (const key in testAsset.dataValues) {
                expect(retrievedAsset).toHaveProperty(key);
                expect(retrievedAsset?.[(key as keyof Asset)]).toEqual(testAsset[(key as keyof Asset)]);
            }
        });

        test("game properties are saved and retrieved correctly", async () => {
            let game = await Game.create({
                name: "test",
                default: false,
                displayName: "Test Game",
                webhookConfig: []
            });
            const retrievedGame = await Game.findByPk(game.name);

            for (const key in game.dataValues) {
                expect(retrievedGame).toHaveProperty(key);
                expect(retrievedGame?.[(key as keyof Game)]).toEqual(game[(key as keyof Game)]);
            }
        });

        test("gameVersion properties are saved and retrieved correctly", async () => {
            let gameVersion = await GameVersion.create({
                version: "1.0.1",
                gameName: testGame.name
            });
            const retrievedGameVersion = await GameVersion.findByPk(gameVersion.id);

            for (const key in gameVersion.dataValues) {
                expect(retrievedGameVersion).toHaveProperty(key);
                expect(retrievedGameVersion?.[(key as keyof GameVersion)]).toEqual(gameVersion[(key as keyof GameVersion)]);
            }
        });

        test("project properties are saved and retrieved correctly", async () => {
            let project = await createDummyProject(testGame.name, testUser.id).save();
            const retrievedProject = await Project.findByPk(project.id);

            for (const key in project.dataValues) {
                expect(retrievedProject).toHaveProperty(key);
                expect(retrievedProject?.[(key as keyof Project)]).toEqual(project[(key as keyof Project)]);
            }
        });

        //test("thingRequest properties are saved and retrieved correctly", async () => {

    });
});