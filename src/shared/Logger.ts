import * as Winston from "winston";
import { EnvConfig } from "./EnvConfig.ts";

export class Logger {
    private static winston: Winston.Logger | undefined;

    public static init() {
        let transports: Winston.transport[] = [];

        let consoleLevel = `consoleInfo`;
        // if (process.env.NODE_ENV == `test`) {
        //    consoleLevel = `warn`;
        // } else if (EnvConfig.isDevMode) {
        //    consoleLevel = `http`;
        // }

        transports.push(new Winston.transports.Console({
            forceConsole: true,
            level: consoleLevel,
            consoleWarnLevels: [`consoleWarn`, `warn`, `error`, `debugWarn`],
            format: Winston.format.combine(
                Winston.format.timestamp({ format: `MM/DD/YY HH:mm:ss` }),
                Winston.format.printf(({ timestamp, level, message }) => {
                    return `[BBM ${level.toUpperCase()}] ${timestamp} > ${message}`;
                })
            )
        }));
        transports.push(new Winston.transports.File({
            filename: `storage/logs/bms.log`,
            //filename: `storage/logs/${new Date(Date.now()).toLocaleDateString(`en-US`, { year: `numeric`, month: `numeric`, day: `numeric`}).replaceAll(`/`, `-`)}.log`,
            zippedArchive: true,
            maxsize: 20 * 1024 * 1024,
            silent: EnvConfig.isTestMode,
            maxFiles: 14,
            level: EnvConfig.isDevMode ? `debug` : `info`,
            format: Winston.format.combine(
                Winston.format.timestamp(),
                Winston.format.json()
            )
        }));

        this.winston = Winston.createLogger({
            level: `info`,
            levels: {
                error: 0,
                warn: 1,
                info: 2,
                consoleWarn: 3,
                consoleInfo: 4,
                debugWarn: 5,
                debug: 6,
                http: 7,
            },
            transports: transports,
        });

        Logger.log(`Logger initialized.`);
    }

    public static log(message: any, level: LogLevel = LogLevel.Info): void {
        if (Logger.winston) {
            Logger.winston.log(level, typeof message === 'string' ? message : JSON.stringify(message));
        } else {
            console.log(`[BBM ${level.toUpperCase()}]`, message);
        }
    }

    public static debug(message: any): void {
        Logger.log(message, LogLevel.Debug);
    }

    public static info(message: any): void {
        Logger.log(message, LogLevel.Info);
    }

    public static warn(message: any): void {
        Logger.log(message, LogLevel.Warn);
    }

    public static error(message: any): void {
        Logger.log(message, LogLevel.Error);
    }
}

export enum LogLevel {
    Error = "error",
    Warn = "warn",  
    Info = "info",
    ConsoleWarn = "consoleWarn",
    ConsoleInfo = "consoleInfo",
    DebugWarn = "debugWarn",
    Debug = "debug",
    Http = "http",
}
