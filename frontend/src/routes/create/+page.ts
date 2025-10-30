import { type AssetRequestPublicAPIv3, type AssetFileFormat, RequestType, UserPermissions } from "$lib/scripts/api/DBTypes";
import { error } from "@sveltejs/kit";
import type { PageLoad } from "./$types.js";

export const ssr = false;
export const load: PageLoad = async ({ parent }) => {
  let parentData = await parent();
  if (!parentData.user) {
    return error(401, {message: 'You must be logged in to view this page', redirectToHome: true});
  }

  if (!parentData.user.roles.includes(UserPermissions.Create_Assets)) {
    return error(403, {message: 'You do not have permission to view this page'});
  }

  return {
    pageMetadata: {
      title: 'Create Asset - ModelSaber',
    },
    user: parentData.user,
  };
}
