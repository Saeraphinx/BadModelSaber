import { error } from '@sveltejs/kit';
import type { PageLoad } from './$types';
import { handleTrpcError, parseTRPCError } from '$lib/scripts/utils/api';
import { UserPermissions } from '$lib/scripts/from_backend/DBExtras';
import { checkRoles } from '$lib/scripts/utils/checkRoles';

export const load = (async ({ fetch, params, parent }) => {
  let id = parseInt(params.id, 10);
  if (isNaN(id)) {
    throw error(404, `Invalid project ID`);
  }
  const { trpc, user } = await parent();
  if (!user) {
    throw error(401, `You must be logged in to view this page`);
  }

  let pnv = await trpc.v3.mods.getProjectAndVersions.query({
    projectId: id
  }).catch(handleTrpcError());
  let gameAndVersions = await trpc.v3.games.getGameVersions.query({
    gameName: pnv.project.gameName ?? ``,
    includeExtras: true,
  }).catch(handleTrpcError());


  
  if (!checkRoles(user, [UserPermissions.Mods_Create], pnv.project.gameName)) {
    return error(403, { message: 'You do not have permission to view this page' });
  }

  return {
    pageMetadata: {
      title: `Upload ${pnv.project.name || `Error`}`,
    },
    pageData: {
      pnv: pnv,
      gav: gameAndVersions,
    },
  };
}) satisfies PageLoad;