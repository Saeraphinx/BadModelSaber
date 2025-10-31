import { AssetFileFormat, LinkedAssetLinkType, Status, type AssetPublicAPIv3, type UserPublicAPIv3 } from '$lib/scripts/api/DBTypes';
import { trpc } from '$lib/scripts/utils/api';
import { error } from '@sveltejs/kit';
import type { PageLoad } from './$types';

export const ssr = false;
export const load = (async ({ fetch, params, parent }) => {
  const parentData = await parent();
  const { user } = parentData;
  let userData: UserPublicAPIv3;
  if (params.id === 'me') {
    console.log('User from parent:', user);
    console.log('Full parent data:', parentData);
    if (!user) {
      error(403, { message: 'You must be logged in to view your profile', subtitle: `You must be logged in to view your profile` });
    }
    userData = user;
  } else {
    userData = await trpc.userRouterV3.getUserById.query({ id: params.id }).then((res) => {
      return res;
    }).catch((err) => {
      console.error(`Failed to fetch user with ID ${params.id}`);
      error(404, `User with ID ${params.id} not found`);
    });
  }

  let assets = await trpc.userRouterV3.getAssetsByUserId.query({ id: userData.id }).then((res) => {
    return res;
  }).catch((err) => {
    console.error(`Failed to fetch assets for user ${userData.id}`);
    error(500, `Failed to fetch assets for user ${userData.id}`);
  });

  return {
    pageMetadata: {
      title: `${userData.displayName || `Error`} - ModelSaber`,
      description: userData.bio,
    },
    pageData: {user: userData, assets: assets || []},
  };
}) satisfies PageLoad;