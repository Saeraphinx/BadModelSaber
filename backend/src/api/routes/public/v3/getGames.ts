import { anyProcedure, router } from "../../../trpc.ts";
import { Game, GameVersion, UserPermissions } from "../../../../shared/Database.ts";

import z from "zod";
import { TRPCError } from "@trpc/server";
import { compare } from "semver";

export const gameRouter = router({
  getGames: anyProcedure().input(z.boolean().default(false)).query(async ({ input, ctx }) => {
    let games = await Game.findAll();
    if (input) {
        if (!ctx.user || !ctx.user.checkRoles([UserPermissions.Game_ViewExtras], `any`)) {
            throw new TRPCError({ code: "FORBIDDEN", message: "You do not have permission to view extra details" });
        }
    }
    return games.map(game => game.toApiV3(input));
  }),
  getGameVersions: anyProcedure().input(z.object({ gameName: z.string(), includeExtras: z.boolean().default(false) })).query(async ({ input, ctx }) => {
    let game = await Game.findByPk(input.gameName);
    if (!game) {
      throw new Error(`Game with name ${input.gameName} not found.`);
    }
    let gameVersions = await GameVersion.findAll({
      where: {
        gameName: input.gameName,
      },
    });

    if (!gameVersions) {
      throw new Error(`Game with name ${input.gameName} not found.`);
    }

    gameVersions.sort((b, a) => compare(a.version, b.version, { loose: true }));

    return {
        game: game.toApiV3(),
        gameVersions: gameVersions.map(version => input.includeExtras ? version.toApiV3_full() : version.toApiV3())
    };
})
});