import { type AssetRequestPublicAPIv3, type AssetFileFormat, RequestType } from "$lib/scripts/api/DBTypes";
import { error } from "@sveltejs/kit";
import type { PageLoad } from "./$types";

export const load: PageLoad = async ({ params, fetch, parent }) => {
  let id = parseInt(params.id);
  if (isNaN(id)) {
    throw error(400, {message: `Invalid request ID.`});
  }
  const { trpc } = await parent();
  let data = await trpc.RequestRouter.getRequest.query({id: id}).then(res => {
    return res;
  }).catch(err => {
    throw error(500, {message: `Failed to fetch request data.`, additionalInfo: err.message});
  });

  return {
    pageData: data,
    pageMetadata: {
      title: `Request ${params.id} - ModelSaber`,
    },
  };
};