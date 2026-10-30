import { anyProcedure, router } from "../../../trpc.ts";
import { Game, GameApiV3Schema, GameVersion, GameVersionApiV3Schema, GameVersionApiV3_fullSchema, UserPermissions } from "../../../../shared/Database.ts";

import z from "zod";
import { TRPCError } from "@trpc/server";
import { compare } from "semver";
import { addCacheHeaders } from "../../../../shared/Tools.ts";
import { Validator } from "../../../../shared/Validator.ts";

export const gameRouter = router({
    getGames: anyProcedure()
        .meta({
            openapi: {
                method: 'GET',
                path: '/v3/games',
                tags: ['games']
            }
        })
        .input(z.object({ includeExtras: z.stringbool().default(false) }).optional())
        .output(z.array(GameApiV3Schema))
        .query(async ({ input, ctx }) => {
            let games = await Game.findAll();
            let allowedExtras = [];
            if (input) {
                for (let game of games) {
                    if (ctx.user && ctx.user.checkRoles([UserPermissions.Game_ViewExtras], `any`)) {
                        allowedExtras.push(game.name);
                    }
                }
            } else {
                addCacheHeaders(ctx);
            }
            return games.map(game => game.toApiV3(allowedExtras.includes(game.name)));
        }),
    getGameVersions: anyProcedure()
        .meta({
            openapi: {
                method: 'GET',
                path: '/v3/games/{gameName}',
                tags: ['games']
            }
        })
        .input(z.object({
            gameName: z.string().max(64),
            includeExtras: z.stringbool().default(false)
        }))
        .output(z.object({
            game: GameApiV3Schema,
            gameVersions: z.array(GameVersionApiV3_fullSchema).or(z.array(GameVersionApiV3Schema))
        }))
        .query(async ({ input, ctx }) => {
        let game = await Game.findByPk(input.gameName);
        if (!game) {
            throw new TRPCError({ code: "NOT_FOUND", message: `Game with name ${input.gameName} not found.` });
        }
        let gameVersions = await GameVersion.findAll({
            where: {
                gameName: input.gameName,
            },
        });

        if (!gameVersions) {
            throw new TRPCError({ code: "NOT_FOUND", message: `Game with name ${input.gameName} not found.` });
        }

        gameVersions.sort((b, a) => compare(a.version, b.version, { loose: true }));
        if (!input.includeExtras) addCacheHeaders(ctx);
        return {
            game: game.toApiV3(),
            gameVersions: gameVersions.map(version => input.includeExtras ? version.toApiV3_full() : version.toApiV3())
        };
    })
});