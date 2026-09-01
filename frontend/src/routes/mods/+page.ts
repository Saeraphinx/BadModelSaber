import { Status } from "$lib/scripts/from_backend/DBExtras";
import type { PageLoad } from "./$types";
import { createTRPC, handleTrpcError } from "$lib/scripts/utils/api.js";

//export const ssr = false;
export const load: PageLoad = async ({ fetch, url }) => {
  const trpc = createTRPC(fetch);
  let game = url.searchParams.get("game");
  let gameVersion = url.searchParams.get("gameVersion");
  let category = (url.searchParams.get("category") ?? ``).toLowerCase().split(",") || [];
  let statuses = (url.searchParams.get("status") ?? ``).toLowerCase().split(",") || [];
  let searchQuery = url.searchParams.get("search") || "";

  if (statuses.every(status => status === "" || Object.values(Status).includes(status as Status))) {
    statuses = statuses.filter(status => status !== "") as Status[];
  }

  let games = await trpc.v3.games.getGames.query().catch(handleTrpcError());
  let gameToQuery = game && games.some(g => g.name === game) ? game : games.find(g => g.isDefault)?.name || games[0]?.name;
  let selectedGame = await trpc.v3.games.getGameVersions.query({
    gameName: gameToQuery,
    includeExtras: true,
  });
  // @ts-expect-error trust me
  let selectedGameVersionId: string = gameVersion && selectedGame.gameVersions.some(v => v.id.toString() === gameVersion) ? gameVersion : selectedGame.gameVersions.find(v => v.isDefault)?.id.toString() || selectedGame.gameVersions[0]?.id.toString();

  return {
    pageMetadata: {
      title: 'Mods',
    },
    pageData: {
      games: games || [],
      startingGame: selectedGame || [],
      query: {
        game: game || null,
        gameVersionId: selectedGameVersionId,
        category: category || null,
        searchQuery: searchQuery || null,
        statuses: statuses as Status[]
      },
    }
  };
}
