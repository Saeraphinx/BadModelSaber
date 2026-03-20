import { error } from '@sveltejs/kit';
import type { PageLoad } from './$types';
import { handleTrpcError, parseError } from '$lib/scripts/utils/api';
import { UserPermissions } from '../../../../lib/scripts/api/DBTypes';
import { checkRoles } from '../../../../lib/scripts/utils/checkRoles';

export const load = (async ({ fetch, params, parent }) => {
  let id = parseInt(params.id, 10);
  if (isNaN(id)) {
    throw error(404, `Invalid project ID`);
  }
  const { trpc, user } = await parent();
  if (!user) {
    throw error(401, `You must be logged in to view this page`);
  }

  let project = await trpc.v3.mods.getProject.query({
    projectId: id
  }).catch(handleTrpcError());

  
  if (!checkRoles(user, [UserPermissions.Mods_Create], project.gameName)) {
    return error(403, { message: 'You do not have permission to view this page' });
  }

  return {
    pageMetadata: {
      title: `Upload ${project.name || `Error`}`,
    },
    pageData: project,
  };
}) satisfies PageLoad;