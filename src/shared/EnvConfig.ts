const DEFAULT_CONFIG = {
    auth: {
        discord: {
            clientId: ``,
            clientSecret: ``,
        },
    },
    server: {
        port: 6001,
        baseUrl: `http://localhost:6001`,
        corsOrigin: `*`, // can be a string or an array of strings.
        corsAllowCredentials: true, // whether to allow credentials in CORS requests
        apiRoute: `/api`, // the base route for the api. no trailing slash
        fileRoute: `/files`, // the base route for the files. no trailing slash
        trustProxy: false, // set to true if behind a reverse proxy like nginx
        storeSessions: true, // whether to store sessions in something other than memory
        storedSessionTimeout: 60 * 60 * 24 * 7, // how long to store sessions in seconds (default: 7 days)
        sessionCookieName: `bms_session`, // the name of the session cookie
        sessionSecret: `supersecretkey`, // the secret for the session cookie
    },
    storage: {
        uploads: `./storage/uploads`, // the directory where uploads are stored
        icons: `./storage/icons`, // the directory where icons are stored
        sqlite_db: `./storage/database.sqlite`, // the path to the sqlite database file (if using sqlite)
        logs: `./storage/logs`, // the directory where logs are stored
        sessions: `./storage/sessions.sqlite`, // the directory where sessions are stored
    },
    database: {
        dialect: `sqlite`, 
        connectionString: `./storage/database.sqlite`, // the connection string for the database
    }
}

export class EnvConfig {
    public static auth: {
            [key: string]: {
                clientId: string;
                clientSecret: string;
            };
        } = DEFAULT_CONFIG.auth;
    public static server: {
            port: number;
            baseUrl: string;
            corsOrigin: string | string[];
            corsAllowCredentials: boolean;
            apiRoute: string;
            fileRoute: string;
            trustProxy: boolean;
            storeSessions: boolean;
            storedSessionTimeout: number;
            sessionCookieName: string;
            sessionSecret: string;
        } = DEFAULT_CONFIG.server;
    public static storage: typeof DEFAULT_CONFIG.storage = DEFAULT_CONFIG.storage;
    public static database: typeof DEFAULT_CONFIG.database = DEFAULT_CONFIG.database;

    public static get isDevMode(): boolean {
        return process.env.NODE_ENV === `development` || process.env.NODE_ENV === `dev`;
    }

    public static get isTestMode(): boolean {
        return process.env.NODE_ENV === `test`;
    }

    public static load(): void {
        
    }
}