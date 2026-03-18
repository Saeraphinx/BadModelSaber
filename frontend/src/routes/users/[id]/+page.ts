import { type UserApiV3 } from '$lib/scripts/api/DBTypes';
import { error, redirect } from '@sveltejs/kit';
import type { PageLoad } from './$types';

//export const ssr = false;
export const load = (async ({ fetch, params, parent }) => {
  const parentData = await parent();
  const { user, trpc } = parentData;
  let userData: UserApiV3;
  if (params.id === 'me') {
    console.log('User from parent:', user);
    console.log('Full parent data:', parentData);
    if (!user) {
      error(403, { message: 'You must be logged in to view your profile', subtitle: `You must be logged in to view your profile` });
    }
    userData = user;
    throw redirect(307, `/users/${user.id}`);
  } else {
    let id = parseInt(params.id, 10);
    userData = await trpc.v3.user.getUserById.query({ id: id }).then((res) => {
      return res;
    }).catch((err) => {
      console.error(`Failed to fetch user with ID ${params.id}`);
      error(404, `User with ID ${params.id} not found`);
    });
  }

  let assets = await trpc.v3.user.getAssetsByUserId.query({ id: userData.id }).then((res) => {
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