import { initTRPC, TRPCError } from '@trpc/server';
import { type CreateExpressContextOptions, createExpressMiddleware } from '@trpc/server/adapters/express';
import { User, UserPermissions } from '../shared/Database.ts';
import { OpenApiMeta } from 'trpc-to-openapi';
import SuperJSON from 'superjson';
import test from 'node:test';
import { parseErrorMessage } from '../shared/Tools.ts';
import { ZodError } from 'zod/v4';
import { fromZodError } from 'zod-validation-error';

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
export async function createContext(opts: CreateExpressContextOptions) {
    let userId = undefined;
    if (opts.req.session?.userId) {
        userId = opts.req.session.userId;
    }

    return {
        req: opts.req,
        res: opts.res,
        userId: userId,
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
        zodError:
          error.code === 'BAD_REQUEST' && error.cause instanceof ZodError
            ? error.cause.flatten()
            : null,
      },
    };
  },
});
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

type ProcedureReturn = ReturnType<
    typeof dummyNoAuth | typeof dummyLoggedIn | typeof dummyAnyLoggedIn
>;

// Function overloads for better type inference
export function authProcedure(permissions: 'any'): ReturnType<typeof dummyNoAuth>;
export function authProcedure(permissions: 'anyCheckAuth'): ReturnType<typeof dummyAnyLoggedIn>;
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

        if (!ctx.userId && permissions !== `anyCheckAuth`) {
            throw new TRPCError({ code: 'UNAUTHORIZED', message: 'You must be logged in to access this resource' });
        }

        const user = await User.findByPk(ctx.userId);
        if (permissions === `anyCheckAuth`) {
            return next({
                ctx: {
                    ...ctx,
                    user,
                }
            });
        }

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