import { DatabaseManager } from "./shared/Database.ts";
import { EnvConfig } from "./shared/EnvConfig.ts";
import express from "express";
import cors from "cors";
import { Logger } from "./shared/Logger.ts";
import 'dotenv/config'

function init() {
    EnvConfig.load();
    Logger.init();
    let db = new DatabaseManager();

    const app = express();
    app.use(cors({
        origin: EnvConfig.server.corsOrigin,
        credentials: EnvConfig.server.corsAllowCredentials,
    }))
    app.use(express.json());
    app.use(express.urlencoded({ extended: true }));
    app.listen(EnvConfig.server.port, () => {
        console.log(`Server is running on ${EnvConfig.server.baseUrl}`);
    });
}
init();