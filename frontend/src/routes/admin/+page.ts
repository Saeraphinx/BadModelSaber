import { UserPermissions } from "$lib/scripts/api/DBTypes";
import { checkRoles } from "$lib/scripts/utils/checkRoles";
import { error } from "@sveltejs/kit";
import type { PageLoad } from "./$types.js";

//export const ssr = false;
export const load: PageLoad = async ({ parent }) => {
  let parentData = await parent();
  if (!parentData.user) {
    return error(401, {message: 'You must be logged in to view this page', redirectToHome: true});
  }

  if (!checkRoles(parentData.user, [UserPermissions.Administrative_Tasks, UserPermissions.Users_EditAllRoles])) {
    return error(403, {message: 'You do not have permission to view this page'});
  }

  return {
    pageMetadata: {
      title: 'Admin Panel - ModelSaber',
    },
    user: parentData.user,
  };
}
