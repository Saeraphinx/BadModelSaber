import type { LayoutLoad } from "./$types";
import { createTRPC, handleTrpcError, parseTRPCError } from "$lib/scripts/utils/api";

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
    let error = handleTrpcError(false)(err);
    if (error.httpCode !== 401) {
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

  let alertRes = await trpc.internal.alerts.getAlertCount.query().catch(handleTrpcError());

  let requestRes = await trpc.internal.requests.requestCounts.query().catch(handleTrpcError());

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