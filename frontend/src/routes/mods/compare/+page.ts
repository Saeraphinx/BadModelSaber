import { UserPermissions } from "$lib/scripts/from_backend/DBExtras";
import { error } from "@sveltejs/kit";
import type { PageLoad } from "./$types";
import { checkRoles } from "$lib/scripts/utils/checkRoles.js";
import { createTRPC, handleTrpcError } from "$lib/scripts/utils/api.js";

//export const ssr = false;
export const load: PageLoad = async ({ fetch }) => {
  const trpc = createTRPC(fetch);

  let games = await trpc.v3.games.getGames.query().catch(handleTrpcError());
  let gameVersions = await trpc.v3.games.getGameVersions.query({
    gameName: games.find(g => g.default)?.name || games[0]?.name,
    includeExtras: true,
  })

  return {
    pageMetadata: {
      title: 'Compare Game Versions',
    },
    pageData: {
      games: games || [],
      defaultGame: gameVersions || [],
    }
  };
}