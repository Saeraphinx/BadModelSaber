import { initTRPC, TRPCError } from '@trpc/server';
import { type CreateExpressContextOptions, createExpressMiddleware } from '@trpc/server/adapters/express';
import { User, UserPermissions } from '../shared/Database.ts';
import { alertsRouter } from './routes/private/alerts.ts';
import { approvalRouter } from './routes/private/approval.ts';
import { RequestRouter } from './routes/private/requests.ts';
import { UpdateAssetRouter } from './routes/private/updateAsset.ts';
import { userRouterV3 } from './routes/public/v3/getUser.ts';
import { assetsRouterV3 } from './routes/public/v3/getAsset.ts';
import { createOpenApiExpressMiddleware, createOpenApiHttpHandler, generateOpenApiDocument, OpenApiMeta } from 'trpc-to-openapi';

// eslint-disable-next-line quotes
declare module 'express-session' {
    export interface Session {
        userId?: string;
    }
}

/**
 * Creates context for an incoming request
 * @see https://trpc.io/docs/v11/context
 */
async function createContext(opts: CreateExpressContextOptions) {
    let userId = undefined;
    if (opts.req.session?.userId) {
        userId = opts.req.session.userId;
    }

    return {
        req: opts.req,
        userId: userId,
    };
}

export type Context = Awaited<ReturnType<typeof createContext>>;

const t = initTRPC.context<Context>().meta<OpenApiMeta>().create();
export const router = t.router;

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

type ProcedureReturn = ReturnType<
    typeof dummyNoAuth | typeof dummyLoggedIn
>;

// Function overloads for better type inference
export function authProcedure(permissions: 'any'): ReturnType<typeof dummyNoAuth>;
export function authProcedure(permissions: 'loggedIn'): ReturnType<typeof dummyLoggedIn>;
export function authProcedure(permissions: UserPermissions[]): ReturnType<typeof dummyLoggedIn>;
export function authProcedure(permissions: any): ProcedureReturn {
    return t.procedure.use(async ({ ctx, next }) => {
        if (permissions === `any`) {
            return next({
                ctx: {
                    ...ctx,
                    user: undefined,
                }
            });
        }

        if (!ctx.userId) {
            throw new TRPCError({ code: 'UNAUTHORIZED', message: 'You must be logged in to access this resource' });
        }

        const user = await User.findByPk(ctx.userId);
        if (!user) {
            throw new TRPCError({ code: 'UNAUTHORIZED', message: 'You must be logged in to access this resource' });
        }

        if (permissions === `loggedIn`) {
            return next({
                ctx: {
                    ...ctx,
                    user,
                }
            });
        }

        if (Array.isArray(permissions) && permissions.length > 0) {
            const hasPermission = permissions.some((permission) => user.roles.includes(permission));
            if (!hasPermission) {
                throw new TRPCError({ code: 'FORBIDDEN', message: 'You do not have permission to access this resource' });
            } else {
                return next({
                    ctx: {
                        ...ctx,
                        user,
                    }
                });
            }
        }

        throw new TRPCError({ code: 'FORBIDDEN', message: 'You do not have permission to access this resource' });
    });
}

const appRouter = router({
    alertsRouter,
    approvalRouter,
    RequestRouter,
    UpdateAssetRouter,
    userRouterV3,
    assetsRouterV3,
});

export type AppRouter = typeof appRouter;
export const loadExpressMiddleware = createExpressMiddleware({
    router: appRouter,
    createContext,
});
export const loadOpenApiMiddleware = createOpenApiExpressMiddleware({ 
    router: appRouter, 
    createContext 
});
export const generateOpenAPIDoc = generateOpenApiDocument(appRouter, {
  title: 'tRPC OpenAPI',
  version: '1.0.0',
  baseUrl: 'http://localhost:3000',
  defs: {
  },
});