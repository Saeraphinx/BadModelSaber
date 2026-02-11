<script lang="ts">
  import RequestCard from "$lib/components/requests/RequestCard.svelte";
  import { type AssetRequestPublicAPIv3 } from "$lib/scripts/api/DBTypes.js";
  import { trpc } from "$lib/scripts/utils/api.js";
  import Badge from "$shadcn/components/ui/badge/badge.svelte";
  import * as Tabs from "$shadcn/components/ui/tabs/index.js";
  import { onMount } from "svelte";
  import { UserPermissions } from "$lib/scripts/api/DBTypes";
  import Button from "$shadcn/components/ui/button/button.svelte";
  import { RefreshCwIcon } from "@lucide/svelte";

  let { data } = $props();

  let incomingRequests: AssetRequestPublicAPIv3[] = $state([]);
  let outgoingRequests: AssetRequestPublicAPIv3[] = $state([]);
  let reports: AssetRequestPublicAPIv3[] | null = $state([]);

  onMount(() => {
    getRequests();
  });

  function getRequests() {
    trpc.RequestRouter.getRequests.query({})
      .then((res) => {
        console.log(res);
        incomingRequests = res.incoming || [];
        outgoingRequests = res.outgoing || [];
        reports = res.reports || null;
      })
      .catch((err) => {
        console.error("Failed to fetch requests:", err);
      });
  }
</script>

{#snippet requestCards(requests: AssetRequestPublicAPIv3[])}
  {#if requests.length > 0}
    <div class="w-full max-w-2xl">
      {#each requests as request}
        <RequestCard {request} class="not-last:mb-4" />
      {/each}
    </div>
  {:else}
    <p class="text-gray-500">You have no requests.</p>
  {/if}
{/snippet}

<div class="flex flex-col items-center justify-center">
  <Tabs.Root class="w-full items-center" value="incoming">
      <Tabs.List>
        <Tabs.Trigger value="outgoing">
          My Outgoing Requests
          <Badge variant="outline">
            {data.requestCounts.outgoing}
          </Badge>
        </Tabs.Trigger>
        <Tabs.Trigger value="incoming">
          Incoming Requests
          <Badge variant="outline">
            {data.requestCounts.incoming}
          </Badge>
        </Tabs.Trigger>
        {#if data.user.roles.includes(UserPermissions.View_All_Reports)}
        <Tabs.Trigger value="admin">
          Admin
          <Badge variant="outline">
            {data.requestCounts.reports}
          </Badge>
        </Tabs.Trigger>
        {/if}
        <Button variant="ghost" size="icon" onclick={getRequests}><RefreshCwIcon /></Button>
      </Tabs.List>
    <Tabs.Content value="outgoing">
      {@render requestCards(outgoingRequests)}
    </Tabs.Content>
    <Tabs.Content value="incoming">
      {@render requestCards(incomingRequests)}
    </Tabs.Content>
    <Tabs.Content value="reports">
      {#if reports !== null}
        {@render requestCards(reports)}
      {:else}
        <p class="text-gray-500">You have no reports.</p>
      {/if}
    </Tabs.Content>
  </Tabs.Root>
  
</div>

<!-- {#if data.requests.outgoing.length > 0}
        <div class="w-full max-w-2xl">
          {#each data.requests.outgoing as request}
            <RequestCard {request} class="not-last:mb-4" />
          {/each}
        </div>
      {:else}
        <p class="text-gray-500">You have no outgoing requests.</p>
      {/if} -->
