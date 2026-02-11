<script lang="ts">
  import AssetCard from "$lib/components/assets/AssetCard.svelte";
  import RequestCard from "$lib/components/requests/RequestCard.svelte";
  import RequestMessage from "$lib/components/requests/RequestMessage.svelte";
  import { RequestType, UserPermissions, type UserPublicAPIv3 } from "$lib/scripts/api/DBTypes.js";
  import { trpc } from "$lib/scripts/utils/api.js";
  import type { RequestMessage as ReqMessage } from "$lib/scripts/api/DBTypes.js";
  import Textarea from "$shadcn/components/ui/textarea/textarea.svelte";
  import Button from "$shadcn/components/ui/button/button.svelte";
  import { m } from "$lib/paraglide/messages.js";
  import { getLocale } from "$lib/paraglide/runtime.js";
  import { onMount } from "svelte";
  import Spinner from "$shadcn/components/ui/spinner/spinner.svelte";
  import { toast } from "svelte-sonner";

  let { data } = $props();

  // Message Content
  let users = $state<Map<string, { id: string; displayName: string; avatarUrl: string }>>(new Map());
  let messages: (ReqMessage & { initMessage?: boolean })[] = $state([]);
  onMount(() => {
    let initialString = "";
    if (data.pageData.requestType === RequestType.Credit) {
      initialString = m["requests.initialMessageCredit"]({
        name: data.pageData?.requester?.displayName || "Unknown User",
        assetName: data.pageData.refrencedAsset?.name || "Unknown Asset",
      });
    } else if (data.pageData.requestType === RequestType.Link) {
      initialString = m["requests.initialMessageLink"]({
        name: data.pageData?.requester?.displayName || "Unknown User",
        assetName: data.pageData.refrencedAsset?.name || "Unknown Asset",
        toLinkAssetName: "Unknown Asset",
      });
    } else {
      initialString = m["requests.initialMessageReport"]({
        name: data.pageData?.requester?.displayName || "Unknown User",
        assetName: data.pageData.refrencedAsset?.name || "Unknown Asset",
      });
    }
    let initMessage = false;
    if (data.user?.roles.includes(UserPermissions.Manage_All_Reports) || (data.pageData.requestResponseBy === data.user?.id)) {
      initMessage = true
      initialString += `\n\n${m["requests.wouldYouLikeToAcceptOrReject"]()}`;
    }

    messages = [
      {
        userId: `5`,
        message: initialString,
        timestamp: new Date(data.pageData.createdAt),
        initMessage,
      },
      ...data.pageData.messages,
    ];
  });
  async function populateUsers() {
    let userIds = new Set<string>();
    userIds.add(`5`); // system user
    data.pageData.messages.forEach((message) => {
      if (message.userId && !users.has(message.userId) && message.userId !== data.user!.id) {
        userIds.add(message.userId);
      }
    });
    users.set(data.user!.id, data.user!);
    if (data.pageData.refrencedAsset && data.pageData.refrencedAsset.uploader && !users.has(data.pageData.refrencedAsset.uploader.id)) {
      users.set(data.pageData.refrencedAsset.uploader.id, data.pageData.refrencedAsset.uploader);
    }
    if (data.pageData.requesterId && !users.has(data.pageData.requesterId)) {
      userIds.add(data.pageData.requesterId);
    }
    let promises = [];
    if (userIds.size > 0) {
      for (const userId of userIds) {
        if (users.has(userId)) continue; // Skip if already fetched
        promises.push(
          trpc.userRouterV3.getUserById
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
    if (data.pageData.requestType !== RequestType.Report) {
      return false;
    }
    if (data.user) {
      if (data.user.roles.includes(UserPermissions.Manage_All_Reports)) {
        return true;
      }
      return data.pageData.accepted === null;
    }
  });
  let isSending = $state(false);
  async function sendMessage() {
    if (messageBox.trim() == "") return;
    isSending = true
    await trpc.RequestRouter.addMessage
      .mutate({
        id: data.pageData.id,
        message: messageBox.trim(),
      })
      .then((res) => {
        messages = [
          ...messages,
          {
            userId: data.user!.id,
            message: messageBox,
            timestamp: new Date(),
          },
        ];
        messageBox = "";
        isSending = false;
      })
      .catch((err) => {
        console.error("Failed to send message:", err);
        toast.error("Failed to send message. Check your error log for more info.")
      });
  }

  async function handleRequest(accepted: boolean) {
    trpc.RequestRouter.handleRequest.mutate({
      action: accepted ? `accept` : `decline`,
      id: data.pageData.id
    })
  }
</script>

<div class="flex flex-row items-start justify-center gap-4" data-sveltekit-preload-code="false">
  <div class="flex flex-col gap-2">
    {#if data.pageData.refrencedAsset}
      <AssetCard asset={data.pageData.refrencedAsset} size="large" alwaysShowHover />
    {/if}
    <div class="flex flex-col items-start gap-2 bg-card p-4 rounded-lg shadow-md w-full max-w-2xl">
      <h1 class="text-2xl font-bold">{m["requests.tableTitle"]({ type: m[`enums.requestTypes.${data.pageData.requestType}`]() })}</h1>
      <p class="text-gray-500">{m["requests.requestID"]({ id: data.pageData.id })}</p>
      <p class="text-gray-500">{m["requests.Status"]({ status: data.pageData.accepted ?? m["enums.status.pending"]() })}</p>
      <p class="text-gray-500">{m["requests.resolvedBy"]({ name: data.pageData.resolvedBy ?? m["requests.notResolved"]() })}</p>
      <p class="text-gray-500">{m["requests.createdBy"]({ name: users.get(data.pageData.requesterId)?.displayName || "Unknown User" })}</p>
      <p class="text-gray-500">{m["requests.createdAt"]({ date: new Date(data.pageData.createdAt).toLocaleDateString() })}</p>
    </div>
  </div>
  <div class="flex flex-col w-full max-w-2xl">
    {#await populateUsers()}
      <p>Loading...</p>
    {:then}
      {#key messages}
        {#each messages as message}
          <RequestMessage accept={() => {handleRequest(true)}} reject={() => {handleRequest(false)}} {message} user={users.get(message.userId) || { id: "0", displayName: "Unknown User", avatarUrl: "" }} class="w-full max-w-2xl mb-4" />
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
