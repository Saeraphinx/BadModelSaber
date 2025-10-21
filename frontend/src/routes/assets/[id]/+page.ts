import { AssetFileFormat, LinkedAssetLinkType, Status, type AssetPublicAPIv3 } from '$lib/scripts/api/DBTypes';
import { error } from '@sveltejs/kit';
import type { PageLoad } from './$types';
import { trpc } from '../../../lib/scripts/utils/api';

export const load = (async ({ fetch, params }) => {
  let id = parseInt(params.id, 10);
  if (isNaN(id)) {
    throw error(404, `Invalid asset ID`);
  }
  let asset = await trpc.assetsRouterV3.getAssetById.query({
    id
  });

  return {
    pageMetadata: {
      title: `${asset.name || `Error`} - ModelSaber`,
      description: asset.description,
    },
    pageData: asset,
  };
}) satisfies PageLoad;