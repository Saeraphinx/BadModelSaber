import { error } from "@sveltejs/kit";
import type { PageLoad } from "./$types";
import { handleTrpcError } from "../../../lib/scripts/utils/api";

//export const ssr = false;
export const load: PageLoad = async ({ parent, params }) => {
  const { user, trpc } = await parent();
  const projectId = parseInt(params.id);

  if (projectId <= 0) {
    throw error(404, 'Invalid project ID');
  }

  let pnv = await trpc.v3.mods.getProjectAndVersions.query({ projectId }).catch(handleTrpcError());

  return {
    pageMetadata: {
      title: `${pnv.project.name}`,
    },
    pageData: pnv,
  };
}
