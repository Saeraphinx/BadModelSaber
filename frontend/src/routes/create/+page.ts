import { UserPermissions } from "$lib/scripts/api/DBTypes";
import { error } from "@sveltejs/kit";
import type { PageLoad } from "./$types.js";
import { checkRoles } from "$lib/scripts/utils/checkRoles.js";

//export const ssr = false;
export const load: PageLoad = async ({ parent }) => {
  const { user } = await parent();
  if (!user) {
    return error(401, {message: 'You must be logged in to view this page', redirectToHome: true});
  }

  if (!checkRoles(user, [UserPermissions.Asset_Create], `any`)) {
    return error(403, {message: 'You do not have permission to view this page'});
  }

  return {
    pageMetadata: {
      title: 'Create Asset - ModelSaber',
    },
    user: user,
  };
}
