import { AssetFileFormat, LinkedAssetLinkType, Status, type AssetPublicAPIv3 } from '$lib/scripts/api/DBTypes';
import { error } from '@sveltejs/kit';
import type { PageLoad } from './$types';
import { createTRPC, parseError, parseErrorMessage, trpc } from '../../../lib/scripts/utils/api';

export const load = (async ({ fetch, params }) => {
  let id = parseInt(params.id, 10);
  if (isNaN(id)) {
    throw error(404, `Invalid asset ID`);
  }
  let asset = await createTRPC(fetch).assetsRouterV3.getAssetById.query({
    id
  }).catch((err) => {
    console.error(`Error fetching asset ${id}: ${err}`);
    let ef = parseError(err);
    throw error(ef.code, {
      additionalInfo: JSON.stringify(err),
      message: `Error fetching asset`,
      subtitle: `${ef.message}`,
    });
  });

  return {
    pageMetadata: {
      title: `${asset.name || `Error`} - ModelSaber`,
      description: asset.description,
    },
    pageData: asset,
  };
}) satisfies PageLoad;