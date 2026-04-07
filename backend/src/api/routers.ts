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
import { uploadStuff } from './routes/public/v3/upload.js';
import { parseErrorMessage } from '../shared/Tools.ts';
import { statusRouter } from './routes/private/getstatus.ts';
import { GetAssetV2Router } from './routes/public/v2/getAsset.ts';
import { GetModsV3 } from './routes/public/v3/getMods.ts';
import { gameRouter } from './routes/public/v3/getGames.ts';
import { editGameRouter } from './routes/private/editGames.ts';
import { getModsInternal } from './routes/private/getProjects.ts';
import { getModsV2Router } from './routes/public/v2/getMods.ts';
import { getEditTranslationsRouter } from './routes/private/getEditTranslations.ts';

const appRouter = router({
    internal: {
        admin: AdminRouter,
        alerts: alertsRouter,
        approval: approvalRouter,
        requests: RequestRouter,
        updateThings: UpdateAssetRouter,
        updateUser: konamiRouter,
        auth: authRouter,
        status: statusRouter,
        games: editGameRouter,
        mods: getModsInternal,
        translation: getEditTranslationsRouter,
    },
    v2: {
        assets: GetAssetV2Router,
        mods: getModsV2Router,
    },
    v3: {
        user: userRouterV3,
        upload: uploadStuff,
        assets: assetsRouterV3,
        mods: GetModsV3,
        games: gameRouter,
    }
});

export const createCaller = createCallerFactory(appRouter);
export type AppRouter = typeof appRouter;
export const loadExpressMiddleware = createExpressMiddleware({
    router: appRouter,
    createContext,
    onError: ({ error, type, path, input, ctx }) => {
        //if (EnvConfig.isDevMode) {
            Logger.error(`tRPC Error on ${type} ${path} (${ctx?.userId || 'unknown'}): ${error.cause ? parseErrorMessage(error.cause) : error.message}`);
            Logger.debug(`input: ${JSON.stringify(input)}`);
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