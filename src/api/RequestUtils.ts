import { Logger, LogLevel } from "../shared/Logger.ts";
import { User, UserRole } from "../shared/Database.ts";
import { NextFunction, Request, Response } from "express";
import fileUpload from 'express-fileupload';
import { z } from "zod/v4";
import { parseErrorMessage } from "../shared/Tools.ts";
import { Snowflake } from "discord.js";
import { EnvConfig } from "../shared/EnvConfig.ts";

// eslint-disable-next-line quotes
declare module 'express-session' {
    export interface Session {
        userId?: string;
    }
}

// eslint-disable-next-line quotes
declare module 'express-serve-static-core' {
    interface Request {
        auth: AuthInfo
    }
}

export type MiddlewareFunction = (req: Request, res: Response, next: NextFunction) => any;

type AuthInfo = {
    isAuthed: false
    user: undefined
} | {
    isAuthed: true
    user: User
};

export function auth(requiredRole: UserRole[] | `loggedIn` | `any`, allowBanned = false): MiddlewareFunction {
    return async (req, res, next) => {
        if (!req.auth) {
            req.auth = {
                isAuthed: false,
                user: undefined
            };
        }

        if (EnvConfig.server.authBypass && typeof EnvConfig.server.authBypass === `string` && EnvConfig.server.authBypass !== `false`) {
            await User.findByPk(EnvConfig.server.authBypass).then(user => {
                if (user) {
                    req.auth.isAuthed = true;
                    req.auth.user = user; 
                } else {
                    Logger.error(`Auth bypass is enabled but the user ${EnvConfig.server.authBypass} does not exist.`);
                }
            }).catch(err => {
                Logger.error(`Error fetching user ${EnvConfig.server.authBypass} for auth bypass: ${err.message}`);
            });
            return next();
        }

        if (requiredRole === `any`) {
            if (req.session?.userId) {
                await User.findByPk(req.session.userId).then(user => {
                    if (user) {
                        req.auth = {
                            isAuthed: true,
                            user: user
                        }
                    }
                }).catch(err => {
                    Logger.error(`Error fetching user from session: ${err.message}`);
                });
            }
            return next(); // Allow any user case to proceed
        } else {
            if (!req.session?.userId) {
                return res.status(401).json({ error: "Unauthorized" });
            }

            return await User.findByPk(req.session.userId).then(user => {
                if (!user) {
                    return res.status(401).json({ error: "Unauthorized" });
                }

                if (user.roles.includes(UserRole.Banned) && !allowBanned) {
                    return res.status(403).json({ error: "Forbidden" });
                }

                if (requiredRole === `loggedIn` || requiredRole.some(role => user.roles.includes(role))) {
                    req.auth = {
                        isAuthed: true,
                        user: user
                    };
                    return next();
                } else {
                    return res.status(403).json({ error: "Forbidden" });
                }
            }).catch(err => {
                Logger.error(`Error fetching user from session: ${err.message}`);
                return res.status(500).json({ message: "Internal Server Error" });
            });
        }
        return res.status(500).json({ message: "Internal Server Error" });
    };
}

export function validate<T extends z.ZodType>(req: Request, res: Response, location: `body` | `query` | `params` | `multipart`, schema: T, options: {
    responseOnError: boolean;
} = {
    responseOnError: true
}): {
    responded: true;
    data?: never;
} | {
    responded: false;
    data: typeof schema._output;
} {
    let preparse: any = null;
    // parse multipart data in caset the request is from the file middleware
    if (location === `multipart`) {
        try {
            if (req.body?.data) {
                let parseddata = JSON.parse(req.body.data);
                if (typeof parseddata === `object` && parseddata !== null) {
                    preparse = parseddata;
                } else {
                    throw new Error("Invalid data format");
                }
            }
        } catch (error) {
            Logger.log(`Error parsing data: ${error}`, LogLevel.DebugWarn);
            options.responseOnError ? res.status(400).json({ message: "Invalid data format" }) : null;
            return { responded: true };
        }
        if (!preparse) {
            options.responseOnError ? res.status(400).json({ message: "Missing required data fields" }) : null;
            return { responded: true };
        }
    }

    let data = location === `multipart` ? preparse : req[location];
    if (typeof data !== `object` || data === null) {
        options.responseOnError ? res.status(400).json({ message: `Invalid data format in ${location}` }) : null;
        return { responded: true };
    }
    let parsedData = schema.safeParse(data);
    if (!parsedData.success) {
        options.responseOnError ? res.status(400).json({ message: parseErrorMessage(parsedData.error) }) : null;
        return { responded: true };
    }
    return {
        responded: false,
        data: parsedData.data
    }
}