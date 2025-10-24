import { alertsRouter } from './routes/private/alerts.ts';
import { approvalRouter } from './routes/private/approval.ts';
import { RequestRouter } from './routes/private/requests.ts';
import { UpdateAssetRouter } from './routes/private/updateAsset.ts';
import { userRouterV3 } from './routes/public/v3/getUser.ts';
import { assetsRouterV3 } from './routes/public/v3/getAsset.ts';
import { createContext, router } from './trpc.ts';
import { AdminRouter } from './routes/private/admin.ts';
import { createExpressMiddleware } from '@trpc/server/adapters/express';
import { createOpenApiExpressMiddleware, generateOpenApiDocument } from 'trpc-to-openapi';
import { authRouter } from './routes/private/auth.ts';
import { konamiRouter } from './routes/private/updateUser.ts';
import { Logger } from '../shared/Logger.ts';
import { uploadAssetV3 } from './routes/private/upload.ts';
import { parseErrorMessage } from '../shared/Tools.ts';

const appRouter = router({
    AdminRouter,
    alertsRouter,
    approvalRouter,
    RequestRouter,
    UpdateAssetRouter,
    userRouterV3,
    konamiRouter,
    assetsRouterV3,
    authRouter,
    uploadAssetV3
});

export type AppRouter = typeof appRouter;
export const loadExpressMiddleware = createExpressMiddleware({
    router: appRouter,
    createContext,
    onError: ({ error, type, path }) => {
        Logger.error(`tRPC Error on ${type} ${path}: ${error.cause ? parseErrorMessage(error.cause) : error.message}`);
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
  version: '1.0.0',
  baseUrl: 'http://localhost:3000'
});