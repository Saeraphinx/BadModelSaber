import { TRPCError } from "@trpc/server";
import { gameProcedure, loggedInProcedure, router } from "../../trpc.ts";
import z, { set } from "zod";
import { Game, GameVersion, UserPermissions, WebhookLogType } from "../../../shared/Database.ts";
import { handleCatch, parseErrorMessage } from "../../../shared/Tools.ts";

export const editGameRouter = router({
    createGame: loggedInProcedure([UserPermissions.Game_Create]).input(z.object({
        gameName: z.string(),
        displayName: z.string(),
    })).mutation(async ({ input }) => {
        let existingGame = await Game.findByPk(input.gameName);
        if (existingGame) {
            throw new TRPCError({ code: "CONFLICT", message: `Game with name ${input.gameName} already exists.` });
        }

        let newGame = await Game.create({
            name: input.gameName,
            displayName: input.displayName,
            default: false,
            webhookConfig: [],
        }).catch(handleCatch(`creating game`));

        return newGame.toApiV3();
    }),
    editGame: gameProcedure([UserPermissions.Game_Edit]).input(z.object({
        gameName: z.string(),
        displayName: z.string().optional(),
        categories: z.array(z.string()).optional(),
        platforms: z.array(z.string()).optional(),
    })).mutation(async ({ ctx, input }) => {
        let game = ctx.game;

        if (input.displayName !== undefined) game.displayName = input.displayName;
        if (input.platforms !== undefined) game.platforms = input.platforms;

        if (input.categories !== undefined) {
            await game.setCategories(input.categories).catch(handleCatch(`setting game categories`));
        }

        await game.save().catch(handleCatch(`editing game`));

        return game.toApiV3();
    }),
    addWebhook: gameProcedure([UserPermissions.Game_Edit]).input(z.object({
        gameName: z.string(),
        url: z.string(),
        types: z.array(z.enum(WebhookLogType)),
        isAssetWebhook: z.boolean().default(false),
    })).mutation(async ({ ctx, input }) => {
        let webhook = await ctx.game.addWebhook({
            url: input.url,
            types: input.types,
            isAssetWebhook: input.isAssetWebhook,
        }).catch(handleCatch(`adding webhook`));

        return ctx.game.getAPIWebhooks();
    }),
    removeWebhook: gameProcedure([UserPermissions.Game_Edit]).input(z.object({
        gameName: z.string(),
        webhookId: z.string(),
    })).mutation(async ({ ctx, input }) => {
        await ctx.game.removeWebhook(input.webhookId).catch(handleCatch(`removing webhook`));

        return ctx.game.getAPIWebhooks();
    }),
    createGameVersion: gameProcedure([UserPermissions.Game_EditVersions]).input(z.object({
        gameName: z.string(),
        version: z.string(),
    })).mutation(async ({ ctx, input }) => {
        let existingVersion = await GameVersion.findOne({
            where: {
                gameName: ctx.game.name,
                version: input.version,
            },
        });
        if (existingVersion) {
            throw new TRPCError({ code: "CONFLICT", message: `Version ${input.version} already exists for game ${ctx.game.name}.` });
        }
        let newVersion = await GameVersion.create({
            gameName: ctx.game.name,
            version: input.version,
            defaultVersion: false,
            linkedVersionIds: [],
        }).catch(handleCatch(`creating game version`));
        return newVersion.toApiV3();
    }),
    setDefaultVersion: gameProcedure([UserPermissions.Game_EditVersions]).input(z.object({
        gameName: z.string(),
        versionId: z.number(),
    })).mutation(async ({ ctx, input }) => {
        let version = await GameVersion.findByPk(input.versionId);
        if (!version || version.gameName !== ctx.game.name) {
            throw new TRPCError({ code: "NOT_FOUND", message: `Version with id ${input.versionId} not found for game ${ctx.game.name}.` });
        }
        version.setDefault().catch(handleCatch(`setting default version`));
        return version.toApiV3();
    }),
    linkVersions: gameProcedure([UserPermissions.Game_EditVersions]).input(z.object({
        gameName: z.string(),
        versionId1: z.number(),
        versionId2: z.number(),
    })).mutation(async ({ ctx, input }) => {
        let { gv1, gv2 } = await GameVersion.linkedVersionIdsUpdate(input.versionId1, input.versionId2).catch(handleCatch(`linking versions`));
        return {
            version1: gv1.toApiV3(),
            version2: gv2.toApiV3(),
        };
    }),
});