import { type AssetRequestPublicAPIv3, type AssetFileFormat, RequestType } from "$lib/scripts/api/DBTypes";
import { error } from "@sveltejs/kit";
import { fetchApi, fetchApiSafe } from "$lib/scripts/utils/api";
import type { PageLoad } from "./$types.js";

export const load: PageLoad = async ({ parent }) => {
  let parentData = await parent();
  if (!parentData.user) {
    return error(401, {message: 'You must be logged in to view this page', redirectToHome: true});
  }

  return {
    pageMetadata: {
      title: 'Requests - ModelSaber',
    },
    user: parentData.user,
  };
}
