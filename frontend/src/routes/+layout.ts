import { User } from "@lucide/svelte";
import type { LayoutLoad } from "./$types";
import { type AlertPublicAPIv3, type AssetRequestPublicAPIv3, type UserPublicAPIv3 } from "$lib/scripts/api/DBTypes";
import { fetchApiSafe } from "$lib/scripts/utils/api";
import { toast } from "svelte-sonner";

export const load: LayoutLoad = async ({ fetch }) => {
  let pendingToasts: Awaited<ReturnType<LayoutLoad>>['pendingToasts'] = [];
  let userToasted = false;
  let alertsToasted = false;
  const defaultObj = {
    fetch,
    alerts: [],
    requestCounts: {
      incoming: 0,
      outgoing: 0,
      reports: null,
    },
    user: undefined,
    pendingToasts: pendingToasts,
  }
  let userRes = await fetchApiSafe<UserPublicAPIv3>("/users/me", {
    method: "GET",
    credentials: "include",
  }, fetch).catch((error) => {
    console.error(`Failed to fetch user data:`, error)
    userToasted = true;
    pendingToasts.push({
      type: 'error',
      title: `Unable to fetch user data`,
      description: `Error: ${error.message}`,
    });
    return {
      response: null,
      message: "Failed to fetch user data",
      data: null,
      status: 500,
      isError: true,
    };
  });

  if (userRes.isError) {
    return defaultObj;
  }

  let alertRes = await fetchApiSafe<AlertPublicAPIv3[]>("/alerts", {
    method: "GET",
    credentials: "include",
  }, fetch).catch((error) => {
    console.error(`Failed to fetch alerts:`, error)
    alertsToasted = true;
    pendingToasts.push({
      type: 'error',
      title: `Unable to fetch alerts`,
      description: `Error: ${error.message}`,
    });
    return {
      response: null,
      message: "Failed to fetch alerts",
      data: null,
      status: 500,
      isError: true,
    };
  });

  let requestRes = await fetchApiSafe<{incoming: number, outgoing: number, reports: number|null}>("/requests/counts", {
    method: "GET",
    credentials: "include",
  }, fetch).catch((error) => {
    console.error(`Failed to fetch requests:`, error);
    return {
      response: null,
      message: "Failed to fetch requests: " + error.message,
      data: null,
      status: 500,
      isError: true,
    };
  });

  if (userRes.isError) {
    if (userRes.status !== 404) {
      console.error(`Failed to fetch user data:`, userRes.message);
      userToasted ? pendingToasts.push({
        type: 'error',
        title: `Unable to fetch user data`,
        description: `Error: ${userRes.message}`,
      }) : null;
      return defaultObj
    }
    return defaultObj;
  }

  if (alertRes.isError && !alertsToasted) {
    console.error(`Failed to fetch alerts:`, alertRes.message);
    pendingToasts.push({
      type: 'error',
      title: `Unable to fetch alerts. Please try again later.`,
      description: `Error: ${alertRes.message}`,
    });
  }

  return {
      fetch,
      pendingToasts: pendingToasts,
      requestCounts: {
        incoming: requestRes.isError ? 0 : requestRes.data?.incoming || 0,
        outgoing: requestRes.isError ? 0 : requestRes.data?.outgoing || 0,
        reports: requestRes.isError ? null : requestRes.data?.reports || null,
      },
      user: userRes.data,
      alerts: alertRes.isError ? [] : (alertRes.data || []),
    }
}