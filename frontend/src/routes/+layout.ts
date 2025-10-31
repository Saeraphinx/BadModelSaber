import type { LayoutLoad } from "./$types";
import { parseError, trpc } from "$lib/scripts/utils/api";

export const load: LayoutLoad = async ({ fetch }) => {
  let pendingToasts: Awaited<ReturnType<LayoutLoad>>['pendingToasts'] = [];
  let userToasted = false;
  let alertsToasted = false;
  const defaultObj = {
    alerts: [],
    requestCounts: {
      incoming: 0,
      outgoing: 0,
      reports: null,
    },
    user: undefined,
    pendingToasts: pendingToasts,
  }
  let userRes = await trpc.userRouterV3.getMe.query().catch((err) => {
    let error = parseError(err);
    userToasted = true;
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

  let alertRes = await trpc.alertsRouter.getAlerts.query({ read: `false`}).catch((error) => {
    console.error(`Failed to fetch alerts:`, error)
    alertsToasted = true;
    pendingToasts.push({
      type: 'error',
      title: `Unable to fetch alerts`,
      description: `Error: ${error.message}`,
    });
  });

  let requestRes = await trpc.RequestRouter.requestCounts.query().catch((error) => {
    console.error(`Failed to fetch requests:`, error);

  });

  return {
      pendingToasts: pendingToasts,
      requestCounts: {
        incoming: !requestRes ? 0 : requestRes.incoming || 0,
        outgoing: !requestRes ? 0 : requestRes.outgoing || 0,
        reports: !requestRes ? null : requestRes.reports || null,
      },
      user: userRes,
      alerts: !alertRes ? [] : (alertRes || []),
    }
}