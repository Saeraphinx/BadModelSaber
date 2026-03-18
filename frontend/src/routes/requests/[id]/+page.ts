import { error } from "@sveltejs/kit";
import type { PageLoad } from "./$types";
import { handleTrpcError } from "$lib/scripts/utils/api";

export const load: PageLoad = async ({ params, fetch, parent }) => {
  const { trpc, user } = await parent();
  if (!user) {
    throw error(403, {message: `You must be logged in to view this request.`});
  }
  let id = parseInt(params.id);
  if (isNaN(id)) {
    throw error(400, {message: `Invalid request ID.`});
  }
  let data = await trpc.internal.requests.getRequest.query({id: id}).then(res => {
    return res;
  }).catch(handleTrpcError());

  return {
    pageData: data,
    user: user,
    pageMetadata: {
      title: `Request ${params.id} - ModelSaber`,
    },
  };
};