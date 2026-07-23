import * as Winston from "winston";
import { EnvConfig } from "./EnvConfig.ts";
import fs from "fs";
import { Writable } from "stream"

export class Logger {
    private static winston: Winston.Logger | undefined;

    public static get instance(): Winston.Logger {
        if (!Logger.winston) {
            throw new Error(`Logger not initialized`);
        }
        return Logger.winston;
    }

    private static streamInstance: Writable | undefined;
    public static get stream(): Writable {
        if (!Logger.winston || !Logger.streamInstance) {
            throw new Error(`Logger not initialized`);
        }
        return Logger.streamInstance!;
    }

    public static init() {
        let transports: Winston.transport[] = [];

        let consoleLevel = `consoleInfo`;
        if (EnvConfig.isTestMode) {
           consoleLevel = `warn`;
        } else if (process.env.LOG_LEVEL) {
            if (!Object.values(LogLevel).includes(process.env.LOG_LEVEL as LogLevel)) {
                console.warn(`Invalid LOG_LEVEL: ${process.env.LOG_LEVEL}. Defaulting to consoleInfo`);
                consoleLevel = `consoleInfo`;
            } else {
                consoleLevel = process.env.LOG_LEVEL as LogLevel;
            }
        }

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

        transports.push(new Winston.transports.Stream({
            stream: Logger.streamInstance = new Writable({
                objectMode: true,
                write(log, encoding, callback) {
                    Logger.streamInstance!.emit(`log`, log);
                    callback();
                }
            })
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
                httpDebug: 8,
            },
            transports: transports,
        });

        Logger.log(`Logger initialized.`);
    }

    public static getLogs(afterTimestamp?: Date): { timestamp: Date; level: LogLevel; message: string }[] {
        if (!Logger.winston) {
            throw new Error(`Logger not initialized`);
        }
        let logs = fs.readFileSync(`storage/logs/bms.log`, `utf-8`);
        let logEntries = logs.split(`\n`).filter(line => line.trim().length > 0).map(line => {
            try {
                let log = JSON.parse(line);
                let date = new Date(log.timestamp);
                if (afterTimestamp && date <= afterTimestamp) {
                    return null;
                }
                return {
                    timestamp: date,
                    level: log.level,
                    message: log.message,
                };
            } catch {
                return null;
            }
        }).filter(entry => entry !== null);
        return logEntries;
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
    HttpDebug = "httpDebug",
}
