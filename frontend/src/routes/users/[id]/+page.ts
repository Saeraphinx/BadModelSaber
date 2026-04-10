import { type UserApiV3 } from '$lib/scripts/api/DBTypes';
import { error, redirect } from '@sveltejs/kit';
import type { PageLoad } from './$types';
import { handleTrpcError } from '../../../lib/scripts/utils/api';

//export const ssr = false;
export const load = (async ({ fetch, params, parent }) => {
  const parentData = await parent();
  const { user, trpc } = parentData;
  let userData: UserApiV3;
  if (params.id === 'me') {
    //console.log('User from parent:', user);
    //console.log('Full parent data:', parentData);
    if (!user) {
      error(403, { message: 'Not logged in', subtitle: `You must be logged in to view your profile` });
    }
    userData = user;
    throw redirect(307, `/users/${user.id}`);
  } else {
    let id = parseInt(params.id, 10);
    userData = await trpc.v3.user.getUserById.query({ id: id }).then((res) => {
      return res;
    }).catch(handleTrpcError());
  }

  let assets = trpc.v3.user.getAssetsByUserId.query({ id: userData.id }).catch(handleTrpcError());
  let mods = trpc.v3.user.getModsByUserId.query({ id: userData.id }).catch(handleTrpcError());
  await Promise.all([assets, mods]);

  return {
    pageMetadata: {
      title: `${userData.displayName || `Error`}`,
      description: userData.bio,
    },
    pageData: {user: userData, assets: (await assets).assets || [], mods: await mods || []},
  };
}) satisfies PageLoad;