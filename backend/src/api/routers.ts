import { alertsRouter } from './routes/private/alerts.ts';
import { RequestRouter } from './routes/private/requests.ts';
import { updateThingsRouter } from './routes/private/editThings.ts';
import { userRouterV3 } from './routes/public/v3/getUser.ts';
import { assetsRouterV3 } from './routes/public/v3/getAsset.ts';
import { createCallerFactory, createContext, router } from './trpc.ts';
import { AdminRouter } from './routes/private/admin.ts';
import { createExpressMiddleware } from '@trpc/server/adapters/express';
import { createOpenApiExpressMiddleware, generateOpenApiDocument } from 'trpc-to-openapi';
import { authRouter } from './routes/private/auth.ts';
import { Logger } from '../shared/Logger.ts';
import { uploadStuff } from './routes/public/v3/upload.js';
import { parseErrorMessage } from '../shared/Tools.ts';
import { statusRouter } from './routes/private/status.ts';
import { GetAssetV2Router } from './routes/public/v2/getAsset.ts';
import { GetModsV3 } from './routes/public/v3/getMods.ts';
import { gameRouter } from './routes/public/v3/getGames.ts';
import { getThingsInternalRouter } from './routes/private/getThings.ts';
import { getModsV2Router } from './routes/public/v2/getMods.ts';
import { getEditTranslationsRouter } from './routes/private/translations.ts';
import { getModsV1Router } from './routes/public/v1/getMods.ts';
import { AdminGetEditRouter } from './routes/private/adminRaw.ts';

const appRouter = router({
    internal: {
        admin: AdminRouter,
        adminRaw: AdminGetEditRouter,
        alerts: alertsRouter,
        requests: RequestRouter,
        getThings: getThingsInternalRouter,
        updateThings: updateThingsRouter,
        auth: authRouter,
        status: statusRouter,
        translation: getEditTranslationsRouter,
    },
    v1: {
        mods: getModsV1Router,
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
            if (path == `v3.user.getMe` && ctx?.userId == undefined && error.code === `UNAUTHORIZED`) {
                return; // Skip logging for this specific case
            }
            Logger.error(`tRPC Error on ${type} ${path} (${ctx?.userId || 'unknown'}): ${error.cause ? parseErrorMessage(error.cause) : error.message}`);
            Logger.debug(`above input: ${JSON.stringify(input)}`);
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