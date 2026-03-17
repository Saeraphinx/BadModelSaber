import type { LayoutLoad } from "./$types";
import { createTRPC, parseError } from "$lib/scripts/utils/api";

export const load: LayoutLoad = async ({ fetch }) => {
  let pendingToasts: Awaited<ReturnType<LayoutLoad>>['pendingToasts'] = [];

  const trpc = createTRPC(fetch);
  const defaultObj = {
    alertCount: 0,
    requestCounts: {
      incoming: 0,
      outgoing: 0,
    },
    user: undefined,
    pendingToasts: pendingToasts,
    trpc
  } satisfies Awaited<ReturnType<LayoutLoad>>;
  let userRes = await trpc.v3.user.getMe.query().catch((err) => {
    console.error(err);
    let error = parseError(err);
    if (error.code == 403) {
      pendingToasts.push({
        type: 'error',
        title: `Unable to fetch user data`,
        description: `${error.message}`,
      });
    }
  });

  if (!userRes) {
    return defaultObj;
  }

  let alertRes = await trpc.internal.alerts.getMyAlertCount.query().catch((err) => {
    console.error(err);
  });

  let requestRes = await trpc.internal.requests.requestCounts.query().catch((err) => {
    console.error(err);
  });

  return {
    pendingToasts: pendingToasts,
    requestCounts: {
      incoming: !requestRes ? 0 : requestRes.incoming || 0,
      outgoing: !requestRes ? 0 : requestRes.outgoing || 0,
    },
    user: userRes,
    alertCount: !alertRes ? 0 : (alertRes || 0),
    trpc
  } satisfies Awaited<ReturnType<LayoutLoad>>;
}