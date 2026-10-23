import { error } from "@sveltejs/kit";
import type { PageLoad } from "./$types.js";
import { m } from "$lib/paraglide/messages";

export const load: PageLoad = async ({ parent }) => {
  let parentData = await parent();
  if (!parentData.user) {
    return error(401, {message: 'You must be logged in to view this page', redirectToHome: true});
  }

  return {
    pageMetadata: {
      title: m[`layout.userMenu.requests`](),
    },
    user: parentData.user,
  };
}
