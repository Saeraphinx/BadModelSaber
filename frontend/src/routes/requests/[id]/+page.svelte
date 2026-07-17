<script lang="ts">
  import AssetCard from "$lib/components/assets/AssetCard.svelte";
  import RequestMessage from "$lib/components/requests/RequestMessage.svelte";
  import { RequestType, UserPermissions, type UserApiV3 } from "$lib/scripts/from_backend/DBExtras.js";
  import { parseErrorMessage } from "$lib/scripts/utils/api.js";
  import type { RequestMessage as ReqMessage } from "$lib/scripts/from_backend/DBExtras.js";
  import Textarea from "$shadcn/components/ui/textarea/textarea.svelte";
  import Button from "$shadcn/components/ui/button/button.svelte";
  import { m } from "$lib/paraglide/messages.js";
  import { onMount } from "svelte";
  import Spinner from "$shadcn/components/ui/spinner/spinner.svelte";
  import { toast } from "svelte-sonner";
  import { checkRoles } from "$lib/scripts/utils/checkRoles.js";

  const { data: _internal } = $props();
  const { trpc, user, pageData } = $derived(_internal);

  let typeInfo: {type: string, nameProp: `username` | `name`, managePerm: UserPermissions} = $derived.by(() => {
    switch (pageData.requestType) {
      case RequestType.User_Report:
        return {type: `user`, nameProp: `username`, managePerm: UserPermissions.Requests_ManageUsers};
      case RequestType.Project_Report:
        return {type: `project`, nameProp: `name`, managePerm: UserPermissions.Requests_ManageMods};
      default:
        return {type: `asset`, nameProp: `name`, managePerm: UserPermissions.Requests_ManageAssets};
    }
  });

  // Message Content
  let users = $state<Map<number, { id: number; displayName: string; avatarUrl: string }>>(new Map());
  let messages: (ReqMessage & { initMessage?: boolean })[] = $state([]);
  onMount(() => {
    let initialString = "";
    if (pageData.requestType === RequestType.Asset_Credit) {
      initialString = m["requests.initialMessageCredit"]({
        name: pageData?.requester?.displayName || "Unknown User",
        assetName: (pageData.refrencedThing && typeInfo.nameProp in pageData.refrencedThing ? pageData.refrencedThing[typeInfo.nameProp as keyof typeof pageData.refrencedThing] : null) ?? "Unknown Asset",
      });
    } else if (pageData.requestType === RequestType.Asset_Link) {
      initialString = m["requests.initialMessageLink"]({
        name: pageData?.requester?.displayName || "Unknown User",
        assetName: (pageData.refrencedThing && typeInfo.nameProp in pageData.refrencedThing ? pageData.refrencedThing[typeInfo.nameProp as keyof typeof pageData.refrencedThing] : null) ?? "Unknown Asset",
        toLinkAssetName: "Unknown Asset",
      });
    } else {
      initialString = m["requests.initialMessageReport"]({
        name: pageData.requester?.displayName || "Unknown User",
        assetName: (pageData.refrencedThing && typeInfo.nameProp in pageData.refrencedThing ? pageData.refrencedThing[typeInfo.nameProp as keyof typeof pageData.refrencedThing] : null) ?? "Unknown Asset",
      });
    }
    let initMessage = false;
    if (checkRoles(user, [UserPermissions.Requests_ManageAll, typeInfo.managePerm], pageData.refrencedGameName) || (pageData.requestResponseBy === user?.id)) {
      if (pageData.accepted === null) {
        initMessage = true
        initialString += `\n\n${m["requests.wouldYouLikeToAcceptOrReject"]()}`;
      }
    }

    messages = [
      {
        userId: 5,
        message: initialString,
        timestamp: new Date(pageData.createdAt).toISOString(),
        initMessage,
      },
      ...pageData.messages,
    ];
  });
  async function populateUsers() {
    let userIds = new Set<number>();
    userIds.add(5); // system user
    pageData.messages.forEach((message) => {
      if (message.userId && !users.has(message.userId) && message.userId !== user.id) {
        userIds.add(message.userId);
      }
    });
    users.set(user.id, user);
    if (pageData.refrencedThing && `uploader` in pageData.refrencedThing && !users.has(pageData.refrencedThing.uploader!.id)) {
      users.set(pageData.refrencedThing.uploader!.id, pageData.refrencedThing.uploader!);
    }
    if (pageData.requesterId && !users.has(pageData.requesterId)) {
      users.set(pageData.requester!.id, pageData.requester!);
    }
    let promises = [];
    if (userIds.size > 0) {
      for (const userId of userIds) {
        if (users.has(userId)) continue; // Skip if already fetched
        promises.push(
          trpc.v3.user.getUserById
            .query({ id: userId })
            .then((res) => users.set(userId, res))
            .catch((err) => {
              console.error(`Failed to fetch user ${userId}:`, err);
              users.set(userId, { id: userId, displayName: `Unknown User ${userId}`, avatarUrl: "/default-avatar.png" });
            }),
        );
      }
    }
    await Promise.allSettled(promises);
  }

  // Message boxes
  let messageBox = $state<string>("");
  let isAllowedToSend = $derived.by(() => {
    if (!pageData.requestType.endsWith("report")) {
      return false;
    }
    if (user) {
      if (checkRoles(user, [UserPermissions.Requests_ManageAll], pageData.refrencedGameName)) {
        return true;
      }
      return pageData.accepted === null;
    }
  });
  let isSending = $state(false);
  async function sendMessage() {
    if (messageBox.trim() == "") return;
    isSending = true
    await trpc.internal.requests.addMessage
      .mutate({
        id: pageData.id,
        message: messageBox.trim(),
      })
      .then((res) => {
        messages = [
          ...messages,
          {
            userId: user!.id,
            message: messageBox,
            timestamp: new Date().toISOString(),
          },
        ];
        messageBox = "";
        isSending = false;
      })
      .catch((err) => {
        console.error("Failed to send message:", err);
        toast.error(m["toasts.error.generic"](), { description: parseErrorMessage(err) });
      });
  }

  async function handleRequest(accepted: boolean) {
    await trpc.internal.requests.handleRequest.mutate({
      action: accepted ? `accept` : `decline`,
      id: pageData.id
    }).then(r => {
      return r.message
    }).catch(e => {
      return toast.error(m["toasts.error.generic"](), { description: parseErrorMessage(e) });
    })
  }
</script>

<div class="flex flex-row items-start justify-center gap-4" data-sveltekit-preload-code="false">
  <div class="flex flex-col gap-2">
    {#if pageData.refrencedThing && `oldId` in pageData.refrencedThing}
      <AssetCard asset={pageData.refrencedThing} size="large" alwaysShowHover />
    {/if}
    <div class="flex flex-col items-start gap-2 bg-card p-4 rounded-lg shadow-md w-full max-w-2xl">
      <h1 class="text-2xl font-bold">{m["requests.tableTitle"]({ type: m[`enums.requestTypes.${pageData.requestType}`]() })}</h1>
      <p class="text-gray-500">{m["requests.requestID"]({ id: pageData.id })}</p>
      <p class="text-gray-500">{m["requests.status"]({ status: pageData.accepted ?? m["requests.notResolved"]() })}</p>
      <p class="text-gray-500">{m["requests.resolvedBy"]({ name: pageData.resolvedBy ?? m["requests.notResolved"]() })}</p>
      <p class="text-gray-500">{m["requests.createdBy"]({ name: users.get(pageData.requesterId)?.displayName || "Unknown User" })}</p>
      <p class="text-gray-500">{m["requests.createdAt"]({ date: new Date(pageData.createdAt).toLocaleDateString() })}</p>
    </div>
  </div>
  <div class="flex flex-col w-full max-w-2xl">
    {#await populateUsers()}
      <p>Loading...</p>
    {:then}
      {#key messages}
        {#each messages as message}
          <RequestMessage accept={() => {handleRequest(true)}} reject={() => {handleRequest(false)}} {message} user={users.get(message.userId) || { id: -1, displayName: "Unknown User", avatarUrl: "" }} class="w-full max-w-2xl mb-4" />
        {:else}
          <p class="text-muted-foreground">{m["requests.noMessagesFound"]}</p>
        {/each}
      {/key}
      {#if isAllowedToSend}
        <div class="flex flex-col items-end">
          <Textarea bind:value={messageBox} placeholder={m["requests.typeYourMessageHere"]()} class="w-full" rows={5} />
          <Button disabled={isSending || messageBox.trim() == ""} variant="default" class="mt-2 w-32" onclick={sendMessage}>
            {m["requests.submitMessage"]()}
            {#if isSending}
              <Spinner />
            {/if}
          </Button>
        </div>
      {/if}
    {:catch error}
      <p class="text-red-500">Error loading messages: {error.message}</p>
    {/await}
  </div>
</div>

<!--
// dont try to read this. save yourself the pain
      message: `Request created by ${data.pageData?.requester?.displayName || "Unknown User"}\n\n${data.pageData.requester?.displayName} would like to ${data.pageData.requestType === RequestType.Credit ? `add you as a collaborator on` : data.pageData.requestType === RequestType.Link ? `add a related link to` : `report`} the asset "${data.pageData.refrencedAsset?.name || "Unknown Asset"}". ${data.user?.roles.includes(UserPermissions.Manage_All_Reports) && data.pageData.requestType !== RequestType.Report && data.user.id !== data.pageData.requesterId ? `Would you like to accept or reject this request?` : ``}`,
      timestamp: new Date(data.pageData.createdAt),
*/
-->
