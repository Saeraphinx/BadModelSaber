import { anyProcedure, router } from "../../../trpc.ts";
import { Game, GameVersion, UserPermissions } from "../../../../shared/Database.ts";

import z from "zod";
import { TRPCError } from "@trpc/server";

export const gameRouter = router({
  getGames: anyProcedure().input(z.boolean().default(false)).query(async ({ input, ctx }) => {
    let games = await Game.findAll();
    if (input) {
        if (!ctx.user || !ctx.user.checkRoles([UserPermissions.Game_Management], `any`)) {
            throw new TRPCError({ code: "FORBIDDEN", message: "You do not have permission to view extra details" });
        }
    }
    return games.map(game => game.toApiV3(input));
  }),
  getGameVersions: anyProcedure().input(z.object({ gameName: z.string() })).query(async ({ input }) => {
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

    return {
        game: game.toApiV3(),
        gameVersions: gameVersions.map(version => version.toApiV3())
    };
})
});