import { DatabaseManager } from "./shared/Database.ts";
import { EnvConfig } from "./shared/EnvConfig.ts";
import express from "express";
import cors from "cors";
import { Logger } from "./shared/Logger.ts";
import 'dotenv/config'
import { AuthRoutes } from "./api/routes/public/all/auth.ts";
import { GetAssetRoutesV3 } from "./api/routes/public/v3/getAsset.ts";
import { ApprovalRoutes } from "./api/routes/private/approval.ts";
import { UploadRoutesV3 } from "./api/routes/public/v3/upload.ts";

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

    const v1Router = express.Router();
    const v2Router = express.Router();
    const v3Router = express.Router();

    // Load API routes
    AuthRoutes.loadRoutes(apiRouter);
    UploadRoutesV3.loadRoutes(v3Router);
    GetAssetRoutesV3.loadRoutes(v3Router);
    ApprovalRoutes.loadRoutes(v3Router);

    apiRouter.use(`/v1`, v1Router);
    apiRouter.use(`/v2`, v2Router);
    apiRouter.use(`/v3`, v3Router);


    app.listen(EnvConfig.server.port, () => {
        console.log(`Server is running on ${EnvConfig.server.baseUrl}`);
    });
}
init();