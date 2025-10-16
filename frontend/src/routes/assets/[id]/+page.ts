import { AssetFileFormat, LinkedAssetLinkType, Status, type AssetPublicAPIv3 } from '$lib/scripts/api/DBTypes';
import { fetchApiSafe } from '$lib/scripts/utils/api';
import { error } from '@sveltejs/kit';
import type { PageLoad } from './$types';

export const load = (async ({ fetch, params }) => {
  let asset = await fetchApiSafe<AssetPublicAPIv3>(`/assets/${params.id}`, {
    method: 'GET',
    credentials: 'include',
  }, fetch);
  if (asset.isError) {
    console.error(`Failed to fetch asset with ID ${params.id}:`, asset.message);
    console.log(asset);
    if (asset.status === 404) {
      throw error(404, {
        message: `Asset not found`,
        title: `Error 404 - Asset Not Found`,
        subtitle: `The asset with ID ${params.id} does not exist or has been deleted.`,
      });
    } else {
      throw error(500, {
        message: `Failed to fetch asset: ${asset.message}`,
        title: `Error 500 - Internal Server Error`,
        subtitle: `An unexpected error occurred while trying to fetch the asset.`,
      });
    }
  }
  let assetData = asset.data;

  return {
    pageMetadata: {
      title: `${assetData.name || `Error`} - ModelSaber`,
      description: assetData.description,
    },
    pageData: assetData,
  };
}) satisfies PageLoad;