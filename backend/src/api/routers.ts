import { alertsRouter } from './routes/private/getEditAlerts.ts';
import { approvalRouter } from './routes/private/approval.ts';
import { RequestRouter } from './routes/private/getEditRequests.ts';
import { UpdateAssetRouter } from './routes/private/editThing.ts';
import { userRouterV3 } from './routes/public/v3/getUser.ts';
import { assetsRouterV3 } from './routes/public/v3/getAsset.ts';
import { createCallerFactory, createContext, router } from './trpc.ts';
import { AdminRouter } from './routes/private/admin.ts';
import { createExpressMiddleware } from '@trpc/server/adapters/express';
import { createOpenApiExpressMiddleware, generateOpenApiDocument } from 'trpc-to-openapi';
import { authRouter } from './routes/private/auth.ts';
import { konamiRouter } from './routes/private/editUser.ts';
import { Logger } from '../shared/Logger.ts';
import { uploadStuff } from './routes/private/upload.ts';
import { parseErrorMessage } from '../shared/Tools.ts';
import { statusRouter } from './routes/private/getstatus.ts';
import { GetV2Router } from './routes/public/v2/getAsset.ts';

const appRouter = router({
    internal: {
        admin: AdminRouter,
        alerts: alertsRouter,
        approval: approvalRouter,
        requests: RequestRouter,
        updateAsset: UpdateAssetRouter,
        updateUser: konamiRouter,
        auth: authRouter,
        status: statusRouter,
    },
    v2: {
        assets: GetV2Router
    },
    v3: {
        user: userRouterV3,
        upload: uploadStuff,
        assets: assetsRouterV3,
    }
});

export const createCaller = createCallerFactory(appRouter);
export type AppRouter = typeof appRouter;
export const loadExpressMiddleware = createExpressMiddleware({
    router: appRouter,
    createContext,
    onError: ({ error, type, path }) => {
        //if (EnvConfig.isDevMode) {
            Logger.error(`tRPC Error on ${type} ${path}: ${error.cause ? parseErrorMessage(error.cause) : error.message}`);
        //}
    }
});
export const loadOpenApiMiddleware = createOpenApiExpressMiddleware({
    router: appRouter,
    createContext,
    responseMeta: undefined,
    onError: undefined,
    maxBodySize: undefined
});
export const generateOpenAPIDoc = generateOpenApiDocument(appRouter, {
  title: 'tRPC OpenAPI',
  version: '0.0.1',
  baseUrl: 'http://localhost:3000'
});