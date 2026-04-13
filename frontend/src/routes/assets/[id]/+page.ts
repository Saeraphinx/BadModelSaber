import { error } from '@sveltejs/kit';
import type { PageLoad } from './$types';
import { handleTrpcError, parseTRPCError } from '$lib/scripts/utils/api';

export const load = (async ({ fetch, params, parent }) => {
  let id = parseInt(params.id, 10);
  if (isNaN(id)) {
    throw error(404, `Invalid asset ID`);
  }
  const { trpc } = await parent();
  let asset = await trpc.v3.assets.getAssetById.query({
    id
  }).catch(handleTrpcError());

  return {
    pageMetadata: {
      title: `${asset.name || `Error`}`,
      description: asset.description,
    },
    pageData: asset,
  };
}) satisfies PageLoad;