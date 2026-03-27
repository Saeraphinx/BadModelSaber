import { UserPermissions } from "$lib/scripts/api/DBTypes";
import { error } from "@sveltejs/kit";
import type { PageLoad } from "./$types";
import { checkRoles } from "$lib/scripts/utils/checkRoles.js";
import { createTRPC } from "../../lib/scripts/utils/api.js";

//export const ssr = false;
export const load: PageLoad = async ({ fetch }) => {
  const trpc = createTRPC(fetch);

  let games = await trpc.v3.games.getGames.query().catch((err) => {
    console.error(err);
    throw error(500, 'Failed to fetch game versions');
  });

  return {
    pageMetadata: {
      title: 'Mods',
    },
    pageData: {
      games: games || [],
    }
  };
}
