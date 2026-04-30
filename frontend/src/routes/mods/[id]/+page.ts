import { error } from "@sveltejs/kit";
import type { PageLoad } from "./$types";
import { handleTrpcError } from "$lib/scripts/utils/api";
import { getProjectThumbnailUrl } from "$lib/scripts/utils/api";

//export const ssr = false;
export const load: PageLoad = async ({ parent, params }) => {
  const projectId = parseInt(params.id);

  if (projectId <= 0) {
    throw error(404, 'Invalid project ID');
  }

  const { user, trpc } = await parent();

  let pnv = await trpc.v3.mods.getProjectAndVersions.query({ projectId }).catch(handleTrpcError());
  let games = await trpc.v3.games.getGameVersions.query({ gameName: pnv.project.gameName }).catch(handleTrpcError());

  return {
    pageMetadata: {
      title: `${pnv.project.name} - ${games.game.displayName}`,
      description: `${pnv.project.summary || 'No summary provided.'}`,
      imageUrl: getProjectThumbnailUrl(pnv.project),
    },
    pageData: {
      pnv: pnv,
      games: games,
    },
  };
}
