import { DatabaseManager } from "./shared/Database.ts";
import { EnvConfig } from "./shared/EnvConfig.ts";
import express from "express";
import cors from "cors";
import { Logger } from "./shared/Logger.ts";
import 'dotenv/config'
import { AuthRoutes } from "./api/routes/auth.ts";
import { GetAssetRoutes } from "./api/routes/getAsset.ts";
import { ApprovalRoutes } from "./api/routes/approval.ts";
import { UploadRoutes } from "./api/routes/upload.ts";

function init() {
    EnvConfig.load();
    Logger.init();
    const db = new DatabaseManager();

    const app = express();
    app.use(cors({
        origin: EnvConfig.server.corsOrigin,
        credentials: EnvConfig.server.corsAllowCredentials,
    }))
    app.use(express.json());
    app.use(express.urlencoded({ extended: true }));

    const apiRouter = express.Router();
    const fileRouter = express.Router();

    // Load API routes
    AuthRoutes.loadRoutes(apiRouter);
    UploadRoutes.loadRoutes(apiRouter);
    GetAssetRoutes.loadRoutes(apiRouter);
    ApprovalRoutes.loadRoutes(apiRouter);

    app.listen(EnvConfig.server.port, () => {
        console.log(`Server is running on ${EnvConfig.server.baseUrl}`);
    });
}
init();