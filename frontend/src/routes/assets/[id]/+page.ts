import { error } from '@sveltejs/kit';
import type { PageLoad } from './$types';
import { handleTrpcError, parseTRPCError } from '$lib/scripts/utils/api';
import { redirect } from '@sveltejs/kit';

export const load = (async ({ fetch, params, url, parent }) => {
  if (params.id == `Sabers` || params.id == `Platforms` || params.id == `Avatars` || params.id == `Notes`) {
    let id = url.searchParams.get('id')
    if (id) {
      throw redirect(307, `/assets/${id}`);
    } else {
      switch (params.id) {
        case `Sabers`:
          throw redirect(307, `/assets?type=saber_saber`);
        case `Notes`:
          throw redirect(307, `/assets?type=note_bloq`);
        case `Platforms`:
          throw redirect(307, `/assets?type=platform_plat`); 
        case `Avatars`:
          throw redirect(307, `/assets?type=avatar_avatar`);
      }
    }
  }

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