import { DatabaseManager } from "./shared/Database.ts";
import { EnvConfig } from "./shared/EnvConfig.ts";
import express from "express";
import session, { SessionOptions } from 'express-session';
import SequelizeStore from 'connect-session-sequelize'
import cors from "cors";
import { Logger } from "./shared/Logger.ts";
import { AuthRoutes } from "./api/routes/public/all/auth.ts";
import { GetAssetRoutesV3 } from "./api/routes/public/v3/getAsset.ts";
import { ApprovalRoutes } from "./api/routes/private/approval.ts";
import { UploadRoutesV3 } from "./api/routes/public/v3/upload.ts";
import { AlertRoutes } from "./api/routes/private/alerts.ts";
import { GetV2 } from "./api/routes/public/v2/get.ts";
import { GetUserRoutesV3 } from "./api/routes/public/v3/getUser.ts";
import { StatusRoutes } from "./api/routes/public/all/status.ts";
import { FileRoutes } from "./api/routes/files/files.ts";
import { Sequelize } from "sequelize";
import { UpdateAssetRoutes } from "./api/routes/private/updateAsset.ts";
import { UpdateUserRoutes } from "./api/routes/private/updateUser.ts";
import { RequestRoutes } from "./api/routes/private/requests.ts";
import { importFromOldModelSaber } from "./shared/Importer.ts";

export async function init(overrideDbName?: string) {
    console.log(`Initializing BadModelSaber...`);
    EnvConfig.load();
    Logger.init();
    EnvConfig.server.authBypass ? Logger.warn(`Auth bypass is enabled. This should only be used in development or testing environments.`) : null;
    const db = new DatabaseManager(overrideDbName);
    //await db.sequelize.query(`DROP SCHEMA public CASCADE;`)
    await db.init();
    //await db.importFakeData();
    //await importFromOldModelSaber()

    const app = express();
    app.use(cors({
        origin: EnvConfig.server.corsOrigin,
        credentials: EnvConfig.server.corsAllowCredentials,
    }))
    app.use(express.json());
    app.use(express.urlencoded({ extended: true }));
    app.set(`trust proxy`, EnvConfig.server.trustProxy);

    // #region Session management
    let sessionOptions: SessionOptions = {
        secret: EnvConfig.server.sessionSecret,
        resave: false,
        saveUninitialized: false,
        unset: `destroy`,
        rolling: true,
        name: EnvConfig.server.sessionCookieName,
        cookie: {
            secure: `auto`,
            maxAge: EnvConfig.server.storedSessionTimeout,
        }
    };
    let sequelizeSessionStore: any | undefined = undefined;
    let sessionSequelize: Sequelize | undefined = undefined;
    if (EnvConfig.server.storeSessions) {
        const SequelizeStoreConstructor = SequelizeStore(session.Store);
        sessionSequelize = new Sequelize(EnvConfig.database.connectionString, {
            logging: false,
            schema: `sessions`,
        });
        await sessionSequelize.query(`CREATE SCHEMA IF NOT EXISTS sessions;`);
        sequelizeSessionStore = new SequelizeStoreConstructor({
            db: sessionSequelize,
        })
        sessionOptions.store = sequelizeSessionStore;
        await sequelizeSessionStore.sync();
    }
    app.use(session(sessionOptions));
    // #endregion

    // #region Register routes
    const apiRouter = express.Router();
    const fileRouter = express.Router();

    const v1Router = express.Router();
    const v2Router = express.Router();
    const v3Router = express.Router();

    AuthRoutes.loadRoutes(apiRouter);
    StatusRoutes.loadRoutes(apiRouter);
    AlertRoutes.loadRoutes(apiRouter);
    ApprovalRoutes.loadRoutes(apiRouter);
    RequestRoutes.loadRoutes(apiRouter);
    UpdateAssetRoutes.loadRoutes(apiRouter);
    UpdateUserRoutes.loadRoutes(apiRouter);
    GetV2.loadRoutes(v2Router);
    UploadRoutesV3.loadRoutes(v3Router); // must be before GetAssetRoutesV3
    GetAssetRoutesV3.loadRoutes(v3Router);
    GetUserRoutesV3.loadRoutes(v3Router);

    apiRouter.use(`/v1`, v1Router);
    apiRouter.use(`/v2`, v2Router);
    apiRouter.use(`/v3`, v3Router);
    apiRouter.use(v3Router);

    FileRoutes.loadRoutes(fileRouter);

    apiRouter.use((req, res, next) => {
        res.status(404).send({message: `Unknown route.`});
    });

    app.use(`${EnvConfig.server.apiRoute}`, apiRouter);
    app.use(`${EnvConfig.server.fileRoute}`, fileRouter);

    // catch all unknown routes and return a 404
    app.use((err:any, req:any, res:any, next:any) => {
        Logger.error(err.stack);
        res.status(500).send({message: `Server error`});
    });
    // #endregion

    let server = app.listen(EnvConfig.server.port, () => {
        Logger.log(`Server is running on ${EnvConfig.server.backendUrl}`);
    });

    return {
        app, server, db, stop: async () => {
            if (server.listening) {
                server.close();
            }
            await db.closeConnenction();
            if (sessionSequelize) {
                await sessionSequelize.close();
            }
            Logger.log(`Server stopped.`);
        }
    };
}

// check if this file is being run directly
if (process.argv[1] === import.meta.filename) {
    const { stop } = await init().catch((err) => {
        Logger.error(`Failed to initialize BadModelSaber: ${err}`);
        process.exit(1);
    });

    process.on('SIGINT', async () => {
        await stop();
    });
}