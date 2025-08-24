import dotenv from 'dotenv';
import * as fs from 'fs';
import path from 'path';

export const DEFAULT_CONFIG = {
    auth: {
        discord: {
            clientId: ``,
            clientSecret: ``,
            token: null
        },
    },
    server: {
        port: 6001,
        frontendUrl: `http://localhost:5173`, // the URL of the frontend, used for redirects
        backendUrl: `http://localhost:6001`, // the URL of the backend, used for internal API calls & potential redirects

        corsOrigin: `default`, // can be a string or an array of strings.
        corsAllowCredentials: false, // whether to allow credentials in CORS requests
        apiRoute: `/api`, // the base route for the api. no trailing slash
        fileRoute: `/files`, // the base route for the files. no trailing slash
        trustProxy: false, // set to true if behind a reverse proxy like nginx
        storeSessions: true, // whether to store sessions in something other than memory
        storedSessionTimeout: 60 * 60 * 24 * 7, // how long to store sessions in seconds (default: 7 days)
        sessionCookieName: `bms_session`, // the name of the session cookie
        sessionCookieSameSite: `strict` as `strict`, // the SameSite attribute for the session cookie
        sessionCookieSecret: `supersecretkey`, // the secret for the session cookie
        authBypass: `false`, // whether to bypass authentication for the API (useful for development. always false in production)
    },
    storage: {
        uploads: `./storage/uploads`, // the directory where uploads are stored
        icons: `./storage/icons`, // the directory where icons are stored
        logs: `./storage/logs`, // the directory where logs are stored
    },
    database: {
        connectionString: ``, // the connection string for the database
    }
}

export class EnvConfig {
    public static auth: {
            [key: string]: {
                clientId: string;
                clientSecret: string;
                token: string | null;
            };
        } = DEFAULT_CONFIG.auth;
    public static server: {
            port: number;
            frontendUrl: string;
            backendUrl: string;
            corsOrigin: string | string[];
            corsAllowCredentials: boolean;
            apiRoute: string;
            fileRoute: string;
            trustProxy: boolean;
            storeSessions: boolean;
            storedSessionTimeout: number;
            sessionCookieName: string;
            sessionCookieSameSite: `strict` | `lax` | `none` | boolean;
            sessionCookieSecret: string;
            authBypass: string | boolean;
        } = DEFAULT_CONFIG.server;
    public static storage: typeof DEFAULT_CONFIG.storage = DEFAULT_CONFIG.storage;
    public static database: typeof DEFAULT_CONFIG.database = DEFAULT_CONFIG.database;

    public static get isProduction(): boolean {
        return process.env.NODE_ENV === `production`;
    }

    public static get isDevMode(): boolean {
        return process.env.NODE_ENV === `development`;
    }

    public static get isTestMode(): boolean {
        return process.env.NODE_ENV === `test`;
    }

    public static get storagePath(): string {
        return path.resolve(`./storage`);
    }

    public static load(): void {
        if (fs.existsSync(`.env`)) {
            dotenv.config({ path: `.env`, quiet: true });
            console.log(`Loading environment configuration from .env`);
        }

        switch (process.env.NODE_ENV) {
            case `production`:
                console.log(`Running in production mode`);
                break;
            case `development`:
                console.log(`Running in development mode`);
                break;
            case `test`:
                console.log(`Running in test mode`);
                break;
            default:
                console.warn(`Unknown NODE_ENV: ${process.env.NODE_ENV}. Defaulting to development mode`);
                process.env.NODE_ENV = `development`;
                break;
        }
        
        if (fs.existsSync(`${process.env.NODE_ENV}.env`)) {
            dotenv.config({ path: `.${process.env.NODE_ENV}.env`, quiet: true });
            console.log(`Loading environment configuration from .${process.env.NODE_ENV}.env`);
        }

        EnvConfig.auth = {
            discord: {
                clientId: process.env.DISCORD_CLIENT_ID || DEFAULT_CONFIG.auth.discord.clientId,
                clientSecret: process.env.DISCORD_CLIENT_SECRET || DEFAULT_CONFIG.auth.discord.clientSecret,
                token: process.env.DISCORD_TOKEN || DEFAULT_CONFIG.auth.discord.token,
            },
        };

        EnvConfig.server = {
            port: parseInt(process.env.PORT || `${DEFAULT_CONFIG.server.port}`),
            frontendUrl: process.env.FRONTEND_URL || DEFAULT_CONFIG.server.frontendUrl,
            backendUrl: process.env.BACKEND_URL || DEFAULT_CONFIG.server.backendUrl,
            corsOrigin: process.env.CORS_ORIGIN?.split(`,`) || DEFAULT_CONFIG.server.corsOrigin,
            corsAllowCredentials: process.env.CORS_ALLOW_CREDENTIALS === `true` || DEFAULT_CONFIG.server.corsAllowCredentials,
            apiRoute: process.env.API_ROUTE || DEFAULT_CONFIG.server.apiRoute,
            fileRoute: process.env.FILE_ROUTE || DEFAULT_CONFIG.server.fileRoute,
            trustProxy: process.env.TRUST_PROXY === `true` || DEFAULT_CONFIG.server.trustProxy,
            storeSessions: process.env.STORE_SESSIONS === `true` || DEFAULT_CONFIG.server.storeSessions,
            storedSessionTimeout: parseInt(process.env.STORED_SESSION_TIMEOUT || `${DEFAULT_CONFIG.server.storedSessionTimeout}`),
            sessionCookieName: process.env.SESSION_COOKIE_NAME || DEFAULT_CONFIG.server.sessionCookieName,
            sessionCookieSameSite: DEFAULT_CONFIG.server.sessionCookieSameSite,
            sessionCookieSecret: process.env.SESSION_SECRET || DEFAULT_CONFIG.server.sessionCookieSecret,
            authBypass: EnvConfig.isDevMode ? process.env.AUTH_BYPASS || false : false,
        };

        if (EnvConfig.server.corsOrigin === `default`) {
            console.warn(`CORS origin is set to 'default'. This may cause issues in production. Please set CORS_ORIGIN in your environment variables.`);
            EnvConfig.server.corsOrigin = [EnvConfig.server.frontendUrl, EnvConfig.server.backendUrl];
        }

        if (process.env.SESSION_COOKIE_SAME_SITE) {
            const sameSite = process.env.SESSION_COOKIE_SAME_SITE.toLowerCase();
            if (sameSite === `strict` || sameSite === `lax` || sameSite === `none`) {
                EnvConfig.server.sessionCookieSameSite = sameSite;
            } else if (sameSite === `true` || sameSite === `false`) {
                EnvConfig.server.sessionCookieSameSite = sameSite === `true`;
            } else {
                console.warn(`Invalid SESSION_COOKIE_SAME_SITE value: ${process.env.SESSION_COOKIE_SAME_SITE}. Using default: ${DEFAULT_CONFIG.server.sessionCookieSameSite}`);
                EnvConfig.server.sessionCookieSameSite = DEFAULT_CONFIG.server.sessionCookieSameSite;
            }
        }

        EnvConfig.storage = {
            uploads: process.env.STORAGE_UPLOADS || DEFAULT_CONFIG.storage.uploads,
            icons: process.env.STORAGE_ICONS || DEFAULT_CONFIG.storage.icons,
            logs: process.env.STORAGE_LOGS || DEFAULT_CONFIG.storage.logs,
        };

        if (!fs.existsSync(EnvConfig.storage.uploads)) {
            fs.mkdirSync(EnvConfig.storage.uploads, { recursive: true });
        }
        if (!fs.existsSync(EnvConfig.storage.icons)) {
            fs.mkdirSync(EnvConfig.storage.icons, { recursive: true });
        }

        EnvConfig.database = {
            connectionString: process.env.DB_CONNECTION_STRING || DEFAULT_CONFIG.database.connectionString,
        };
    }
}