import { initTRPC, TRPCError } from '@trpc/server';
import { type CreateExpressContextOptions, createExpressMiddleware } from '@trpc/server/adapters/express';
import type { CreateWSSContextFnOptions } from '@trpc/server/adapters/ws';
import { Asset, DatabaseManager, Game, GameVersion, Project, User, UserPermissions, Version } from '../shared/Database.ts';
import { OpenApiMeta } from 'trpc-to-openapi';
import SuperJSON from 'superjson';
import { parseErrorMessage } from '../shared/Tools.ts';
import z, { ZodError } from 'zod/v4';
import { Session, SessionData } from 'express-session';


// eslint-disable-next-line quotes
declare module 'express-session' {
    export interface Session {
        userId?: number;
    }
}

// inherits from express request obj
declare module 'http' {
  interface IncomingMessage {
    session: Session & Partial<SessionData>;
    database: DatabaseManager;
  }
}

/**
 * Creates context for an incoming request
 * @see https://trpc.io/docs/v11/context
 */
export function createContext(opts: CreateExpressContextOptions) {
    let userId = undefined;
    if (opts.req.session?.userId) {
        userId = opts.req.session.userId;
    }

    return {
        req: opts.req,
        res: opts.res,
        userId: userId,
        db: opts.req.database,
    };
}

export type Context = Awaited<ReturnType<typeof createContext>>;

const t = initTRPC.context<Context>().meta<OpenApiMeta>().create({
    transformer: SuperJSON,
    errorFormatter(opts) {
        const { shape, error } = opts;
        return {
            ...shape,
            data: {
                ...shape.data,
                formattedMessage: parseErrorMessage(error.cause),
                zodError: error.code === 'BAD_REQUEST' && error.cause instanceof ZodError
                        ? error.cause
                        : undefined,
            },
        };
    },
});

export const createCallerFactory = t.createCallerFactory;
export const router = t.router;
export const publicProcedure = t.procedure;

//dummy no auth procedure
function dummyNoAuth() {
    return t.procedure.use(async ({ ctx, next }) => {
        return next({
            ctx: {
                ...ctx,
                user: undefined,
            }
        });
    });
}

// dummy logged in procedure
function dummyLoggedIn() {
    return t.procedure.use(async ({ ctx, next }) => {
        return next({
            ctx: {
                ...ctx,
                user: {} as User,
            }
        });
    });
}

function dummyAnyLoggedIn() {
    return t.procedure.use(async ({ ctx, next }) => {
        return next({
            ctx: {
                ...ctx,
                user: ctx.userId ? {} as User : null,
            }
        });
    });
}

// Function overloads for better type inference
export function anyProcedure(): ReturnType<typeof dummyAnyLoggedIn> {
    return t.procedure.use(async ({ ctx, next }) => {
        if (!ctx.userId) {
            return next({
                ctx: {
                    ...ctx,
                    user: null,
                }
            });
        }

        const user = await User.findByPk(ctx.userId);
        if (!user) {
            return next({
                ctx: {
                    ...ctx,
                    user: null,
                }
            });
        } else {
            return next({
                ctx: {
                    ...ctx,
                    user: user,
                }
            });
        }
    });
}

export function notLoggedInProcedure() {
    return t.procedure.use(async ({ ctx, next }) => {
        if (ctx.userId) {
            let user = await User.findByPk(ctx.userId);
            if (user) {
                throw new TRPCError({ code: 'FORBIDDEN', message: 'You are already logged in.' });
            } else {
                return next({
                    ctx: {
                        ...ctx,
                        user: null,
                    }
                });
            }
        } else {
            return next({
                ctx: {
                    ...ctx,
                    user: null,
                }
            });
        }
    });
}

export function loggedInProcedure(roles?: UserPermissions[] | { hasAllOf?: UserPermissions[], hasOneOf?: UserPermissions[], denied?: UserPermissions[] }): ReturnType<typeof dummyLoggedIn> {
    return t.procedure.use(async ({ ctx, next }) => {
        let user = await roleCheckLogic(ctx, roles);
        return next({
            ctx: {
                ...ctx,
                user: user,
            }
        });
    });
}
export function anyGameProcedure(roles?: UserPermissions[] | { hasAllOf?: UserPermissions[], hasOneOf?: UserPermissions[], denied?: UserPermissions[] }) {
    return t.procedure.input(z.object({
        gameName: z.string()
    })).use(async ({ ctx, next, input }) => {
        let user = await User.findByPk(ctx.userId || undefined);
        return next({
            ctx: {
                ...ctx,
                user: user,
            }
        });
    });
}
export function gameProcedure(roles?: UserPermissions[] | { hasAllOf?: UserPermissions[], hasOneOf?: UserPermissions[], denied?: UserPermissions[] }) {
    return t.procedure.input(z.object({
        gameName: z.string()
    })).use(async ({ ctx, next, input }) => {
        let user = await roleCheckLogic(ctx, roles, input.gameName);
        let game = await Game.findByPk(input.gameName);
        if (!game) {
            throw new TRPCError({ code: 'NOT_FOUND', message: `Game with name ${input.gameName} not found.` });
        }
        return next({
            ctx: {
                ...ctx,
                user: user,
                game: game,
            }
        });
    });
}

export function loggedInProjectProcedure(roles?: UserPermissions[] | { hasAllOf?: UserPermissions[], hasOneOf?: UserPermissions[], denied?: UserPermissions[] }) {
    return t.procedure.input(z.object({
        id: z.number()
    })).use(async ({ ctx, next, input }) => {
        let project = await Project.findByPk(input.id);
        if (!project) {
            throw new TRPCError({ code: 'NOT_FOUND', message: `Project with ID ${input.id} not found.` });
        }
        let user = await roleCheckLogic(ctx, roles, project.gameName);
        return next({
            ctx: {
                ...ctx,
                user: user,
                project: project,
            }
        });
    });
}

export function loggedInVersionProcedure(roles?: UserPermissions[] | { hasAllOf?: UserPermissions[], hasOneOf?: UserPermissions[], denied?: UserPermissions[] }) {
    return t.procedure.input(z.object({
        id: z.number()
    })).use(async ({ ctx, next, input }) => {
        let version = await Version.findByPk(input.id, {
            include: [Project, GameVersion, User]
        });
        if (!version) {
            throw new TRPCError({ code: 'NOT_FOUND', message: `Version with ID ${input.id} not found.` });
        }
        let project = await version.project;
        if (!project) {
            throw new TRPCError({ code: 'NOT_FOUND', message: `Project for version with ID ${input.id} not found.` });
        }
        let user = await roleCheckLogic(ctx, roles, project.gameName);
        return next({
            ctx: {
                ...ctx,
                user: user,
                project: project,
                version: version,
            }
        });
    });
}

export function loggedInAssetProcedure(roles?: UserPermissions[] | { hasAllOf?: UserPermissions[], hasOneOf?: UserPermissions[], denied?: UserPermissions[] }) {
    return t.procedure.input(z.object({
        id: z.number()
    })).use(async ({ ctx, next, input }) => {
        let asset = await Asset.findByPk(input.id, {
            include: [User]
        });
        if (!asset) {
            throw new TRPCError({ code: 'NOT_FOUND', message: `Asset with ID ${input.id} not found.` });
        }
        let user = await roleCheckLogic(ctx, roles, asset.gameName);
        return next({
            ctx: {
                ...ctx,
                user: user,
                asset: asset,
            }
        });
    });
}

async function roleCheckLogic(ctx: Context, roles?: UserPermissions[] | { hasAllOf?: UserPermissions[], hasOneOf?: UserPermissions[], denied?: UserPermissions[] }, gameName?:string): Promise<User> {
    if (!ctx.userId) {
        throw new TRPCError({ code: 'UNAUTHORIZED', message: 'You are not logged in.' });
    }

    // Fetch user from database
    const user = await User.findByPk(ctx.userId);
    if (!user) {
        ctx.req.session.userId = undefined;
        ctx.req.session.save();
        throw new TRPCError({ code: 'UNAUTHORIZED', message: 'User not found.' });
    }

    if (roles) {
        try {
            // stupid typescript overloading
            const hasPermission = Array.isArray(roles)
                ? user.checkRoles(roles, gameName)
                : user.checkRoles(roles, gameName);

            if (hasPermission) {
                return user;
            } else {
                throw new TRPCError({ code: 'FORBIDDEN', message: 'You do not have the required permissions.' });
            };
        } catch (error) {
            throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR', message: parseErrorMessage(error) });
        }
    } else {
        return user;
    }
}