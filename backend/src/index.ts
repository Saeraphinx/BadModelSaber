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
import { createCaller, generateOpenAPIDoc, loadExpressMiddleware, loadOpenApiMiddleware } from "./api/routers.ts";
import swaggerUi from "swagger-ui-express";
import { file } from "jszip";
import { OpenAPIUploadDocs } from "./api/routes/public/v3/upload.ts";

    // eslint-disable-next-line quotes
    declare module 'express-serve-static-core' {
        interface Request {
            database: DatabaseManager;
        }
    }

export async function init(overrideDbName?: string) {
    console.log(`Initializing BadModelSaber...`);
    EnvConfig.load();
    Logger.init();
    EnvConfig.server.authBypass != -1 ? Logger.warn(`Auth bypass is enabled. This should only be used in development or testing environments.`) : null;
    const schemaToUse = overrideDbName ? overrideDbName : `${EnvConfig.database.schema}`;
    const db = new DatabaseManager(schemaToUse);
    await db.init();

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
    const apiRouter = express.Router();
    const fileRouter = express.Router();

    apiRouter.use((req, res, next) => {
        let url = EnvConfig.server.hideFullQueryInLogs ? req.originalUrl.split("?")[0] : req.originalUrl;
        Logger.log(`${req.method} ${url} - ${req.ip} - Session: ${req.sessionID} - Auth: ${req.session['userId'] ? req.session['userId'] : `No`}`, LogLevel.Http);
        Logger.log(`Received Headers: ${JSON.stringify(req.headers)}`, LogLevel.HttpDebug);
        if (!EnvConfig.isProduction && EnvConfig.server.authBypass && !req.session['userId']) {
            if (EnvConfig.server.authBypass !== -1) {
                req.session.userId = EnvConfig.server.authBypass;
                Logger.warn(`Auth bypass enabled - automatically logged in as user ID ${req.session.userId}`);
            }
        }
        res.on('finish', () => {
            Logger.log(`Sent Headers: ${JSON.stringify(res.getHeaders())}`, LogLevel.HttpDebug);
        });
        next();
    });

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
    apiDoc.paths = {
        ...apiDoc.paths,
        ...OpenAPIUploadDocs
    }

    apiRouter.use(`/docs`, swaggerUi.serve, swaggerUi.setup(apiDoc));

    apiRouter.use(`/trpc`, (req, res, next) => {
        req.database = db;
        next();
    });
    apiRouter.use(`/trpc`, loadExpressMiddleware);
    // Legacy route handling - redirect old v2 routes to new v2 routes because past me was a fucking idiot
    apiRouter.use((req, res, next) => {
        if (req.url.startsWith(`/mods`)) {
            req.url = req.url.replace(`/mods`, `/v2/mods`);
            return next();
        }
        if (req.url.startsWith(`/hashlookup`)) {
            req.url = req.url.replace(`/hashlookup`, `/v2/hashlookup`);
            return next();
        }
        if (req.url.startsWith(`/multi/hashlookup`)) {
            req.url = req.url.replace(`/multi/hashlookup`, `/v2/multi/hashlookup`);
            return next();
        }

        let caller: Promise<any> | null = null;
        if (req.url.startsWith(`/v3/asset/upload`) && req.method === 'POST') {
            caller = createCaller({
                req, res, db,
                userId: req.session['userId'],
            }).v3.upload.assetUpload(req.body);
        } else if (req.url.match(/^\/v3\/project\/[^\/]+\/upload$/) && req.method === 'POST') {
            caller = createCaller({
                req, res, db,
                userId: req.session['userId'],
            }).v3.upload.versionUpload({
                id: req.url.split(`/`)[3],
                ...req.body
            });
        }

        if (caller) {
            return caller.then((result) => {
                return res.json(result);
            }).catch((err) => {
                Logger.error(`Error handling legacy upload route: ${err}`);
                res.status(500).json({ message: `Server error` });
            });
        } else {
            next();
        }
    });
    apiRouter.use(loadOpenApiMiddleware); // load all openapi routes

    FileRoutes.loadRoutes(fileRouter);

    apiRouter.use((req, res, next) => {
        res.status(404).send({message: `Unknown route.`});
    });

    app.use(`${EnvConfig.server.apiRoute}`, apiRouter);
    app.use(`${EnvConfig.server.fileRoute}`, fileRouter);

    // catch all unknown routes and return a 404
    app.use((err:any, req:any, res:any, next:any) => {
        if (err.message === `Cannot set headers after they are sent to the client`) {
            Logger.debug(`Attempted to send headers after response was already sent. Likely caused by authentication.`);
            return;
        }
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