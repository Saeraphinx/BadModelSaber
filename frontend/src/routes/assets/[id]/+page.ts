import { error } from '@sveltejs/kit';
import type { PageLoad } from './$types';
import { handleTrpcError, parseTRPCError } from '$lib/scripts/utils/api';
import { redirect } from '@sveltejs/kit';
import { checkAssetRedirect } from '../../../lib/scripts/utils/redirects';

export const load = (async ({ fetch, params, parent }) => {
  if (params.id == `Sabers` || params.id == `Notes` || params.id == `Platforms` || params.id == `Avatars`) {
    checkAssetRedirect(params.id, new URLSearchParams());
  }
  
  let id = parseInt(params.id, 10);
  if (isNaN(id)) {
    throw error(404, `Invalid asset ID`);
  }
  const { trpc } = await parent();
  let asset = await trpc.v3.assets.getAssetById.query({
    id
  }).catch(handleTrpcError());

  if (asset.id !== id) {
    throw redirect(307, `/assets/${asset.id}`);
  }

  return {
    pageMetadata: {
      title: `${asset.name || `Error`}`,
      description: asset.description,
    },
    pageData: asset,
  };
}) satisfies PageLoad;