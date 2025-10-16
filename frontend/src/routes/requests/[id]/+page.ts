import { type AssetRequestPublicAPIv3, type AssetFileFormat, RequestType } from "$lib/scripts/api/DBTypes";
import { error } from "@sveltejs/kit";
import type { PageLoad } from "./$types";
import { fetchApi, fetchApiSafe } from "$lib/scripts/utils/api";

export const load: PageLoad = async ({ params, fetch }) => {
  let data = await fetchApi<AssetRequestPublicAPIv3>(`/requests/${params.id}`, {}, fetch).then(res => {
    if (`id` in res.data !== true) {
      error(500, { message: `No data received from API`, additionalInfo: res.message });
    }
    return res.data;
  }).catch(err => {
    if (err.status === 404) {
      throw error(404, {
        message: err.message,
        redirectToHome: true,
      });
    } else if (err.status === 403) {
      throw error(403, {
        message: err.message,
        redirectToHome: true,
      });
    } else {
      throw error(500, {
        message: "An unexpected error occurred while fetching the request.",
        additionalInfo: "See logs for more info."
      });
    }
  });

  return {
    pageData: data,
    pageMetadata: {
      title: `Request ${params.id} - ModelSaber`,
    },
  };
};