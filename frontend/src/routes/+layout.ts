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
    trpc: trpc,
    fetch: fetch,
  } satisfies Awaited<ReturnType<LayoutLoad>>;
  let userRes = await trpc.v3.user.getMe.query().catch((err) => {
    let error = parseError(err);
    if (error.code !== 401) {
      console.error(err);
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

  let alertRes = await trpc.internal.alerts.getAlertCount.query().catch((err) => {
    console.error(err);
  });

  let requestRes = await trpc.internal.requests.requestCounts.query().catch((err) => {
    console.error(err);
  });

  return {
    pendingToasts: pendingToasts,
    requestCounts: {
      incoming: requestRes ? requestRes.incoming || 0 : 0,
      outgoing: requestRes ? requestRes.outgoing || 0 : 0,
    },
    user: userRes,
    alertCount: alertRes ? alertRes : 0,
    trpc: trpc,
    fetch: fetch,
  } satisfies Awaited<ReturnType<LayoutLoad>>;
}