import { DatabaseManager } from "./shared/Database.ts";
import { EnvConfig } from "./shared/EnvConfig.ts";
import express from "express";
import session, { SessionOptions } from 'express-session';
import SequelizeStore from 'connect-session-sequelize'
import cors from "cors";
import { Logger, LogLevel } from "./shared/Logger.ts";
import { FileRoutes } from "./api/routes/files/files.ts";
import { Sequelize } from "sequelize";
import { importFromOldModelSaber } from "./shared/Importer.ts";
import { generateOpenAPIDoc, loadExpressMiddleware, loadOpenApiMiddleware } from "./api/routers.ts";
import swaggerUi from "swagger-ui-express";
import { file } from "jszip";

export async function init(overrideDbName: string = `public`) {
    console.log(`Initializing BadModelSaber...`);
    EnvConfig.load();
    Logger.init();
    EnvConfig.server.authBypass ? Logger.warn(`Auth bypass is enabled. This should only be used in development or testing environments.`) : null;
    const schemaToUse = EnvConfig.isDevMode ? `dev_${overrideDbName}` : overrideDbName;
    const db = new DatabaseManager(schemaToUse);
    if (EnvConfig.isDevMode) {
        await db.dropSchema();
    }
    await db.init();
    if (EnvConfig.isDevMode) {
        await db.importFakeData();
    }
    //await importFromOldModelSaber()

    const app = express();
    //app.use(express.json());
    //app.use(express.urlencoded({ extended: false }));
    app.set(`trust proxy`, EnvConfig.server.trustProxy);
    app.set(`x-powered-by`, false);

    // #region Session management
    let sessionOptions: SessionOptions = {
        secret: EnvConfig.server.sessionCookieSecret,
        resave: false,
        saveUninitialized: false,
        unset: `destroy`,
        rolling: true,
        name: EnvConfig.server.sessionCookieName,
        cookie: {
            secure: `auto`,
            maxAge: EnvConfig.server.storedSessionTimeout,
            httpOnly: true,
            sameSite: EnvConfig.server.sessionCookieSameSite
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
    app.use((req, res, next) => {
        Logger.log(`${req.method} ${req.originalUrl} - ${req.ip} - Session: ${req.sessionID} - Auth: ${req.session['userId'] ? req.session['userId'] : `No`}`, LogLevel.Http);
        if (!EnvConfig.isProduction && EnvConfig.server.authBypass && !req.session['userId']) {
            if (typeof EnvConfig.server.authBypass === `boolean`) {
                req.session.userId = `5`;
            } else {
                req.session.userId = EnvConfig.server.authBypass;
            }
            Logger.warn(`Auth bypass enabled - automatically logged in as user ID ${req.session.userId}`);
        }
        next();
    });
    const apiRouter = express.Router();
    const fileRouter = express.Router();

    apiRouter.use(cors({
        origin: EnvConfig.server.corsOrigin,
        credentials: EnvConfig.server.corsAllowCredentials,
    }))

    // todo: add seperate cors settings for fileRouter if needed
    fileRouter.use(cors({
        origin: `*`,
    }))

    let apiDoc = generateOpenAPIDoc;
    apiDoc.servers = [{
        url: EnvConfig.server.backendUrl + EnvConfig.server.apiRoute
    }]

    apiRouter.use(`/docs`, swaggerUi.serve, swaggerUi.setup(apiDoc));

    apiRouter.use(`/trpc`, loadExpressMiddleware);
    apiRouter.use(loadOpenApiMiddleware); // load all openapi routes

    FileRoutes.loadRoutes(fileRouter);

    apiRouter.use((req, res, next) => {
        res.status(404).send({message: `Unknown route.`});
    });

    app.use(`${EnvConfig.server.apiRoute}`, apiRouter);
    app.use(`${EnvConfig.server.fileRoute}`, fileRouter);

    // catch all unknown routes and return a 404
    app.use((err:any, req:any, res:any, next:any) => {
        Logger.error(err.stack);
        if (!res.headersSent) {
            res.status(500).send({message: `Server error`});
        }
    });
    // #endregion

    let server = app.listen(EnvConfig.server.port, () => {
        Logger.log(`Server is running on ${EnvConfig.server.backendUrl}`);
        console.log(`http://localhost:6001/api/users/me`);
        console.log(`http://localhost:6001/api/auth/discord`);
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