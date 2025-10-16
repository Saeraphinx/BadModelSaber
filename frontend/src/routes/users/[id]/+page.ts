import { AssetFileFormat, LinkedAssetLinkType, Status, type AssetPublicAPIv3, type UserPublicAPIv3 } from '$lib/scripts/api/DBTypes';
import { fetchApiSafe } from '$lib/scripts/utils/api';
import { error } from '@sveltejs/kit';
import type { PageLoad } from './$types';

export const load = (async ({ fetch, params, parent }) => {
  let userData: UserPublicAPIv3;
  if (params.id === 'me') {
    const { user } = await parent();
    if (!user) {
      error(403, 'You must be logged in to view your profile');
    }
    userData = user;
  } else {
    let user = await fetchApiSafe(`/users/${params.id}`, {
      method: 'GET',
      credentials: 'include',
    }, fetch);
    if (user.isError) {
      console.error(`Failed to fetch user with ID ${params.id}:`, user.message);
      console.log(user);
      error(404, `User with ID ${params.id} not found`);
    }
    userData = await user.data as UserPublicAPIv3;
  }

  let assets = await fetchApiSafe<{assets: AssetPublicAPIv3[]}>(`/users/${userData.id}/assets`, {
    method: 'GET',
    credentials: 'include',
  }, fetch);
  if (assets.isError) {
    console.error(`Failed to fetch assets for user ${userData.id}:`, assets.message);
    error(500, `Failed to fetch assets for user ${userData.id}`);
  }

  return {
    pageMetadata: {
      title: `${userData.displayName || `Error`} - ModelSaber`,
      description: userData.bio,
    },
    pageData: {userData, assets: assets.data.assets || []},
  };
}) satisfies PageLoad;