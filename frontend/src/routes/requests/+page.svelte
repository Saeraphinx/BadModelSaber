<script lang="ts">
  import RequestCard from "$lib/components/requests/RequestCard.svelte";
  import { type AssetRequestPublicAPIv3 } from "$lib/scripts/api/DBTypes.js";
  import { fetchApi } from "$lib/scripts/utils/api.js";
  import Badge from "$shadcn/components/ui/badge/badge.svelte";
  import * as Tabs from "$shadcn/components/ui/tabs/index.js";
  import { onMount } from "svelte";

  let { data } = $props();

  let incomingRequests: AssetRequestPublicAPIv3[] = $state([]);
  let outgoingRequests: AssetRequestPublicAPIv3[] = $state([]);
  let reports: AssetRequestPublicAPIv3[] | null = $state([]);

  onMount(() => {
    fetchApi<{
      incoming: AssetRequestPublicAPIv3[];
      outgoing: AssetRequestPublicAPIv3[];
      reports: AssetRequestPublicAPIv3[] | null;
    }>(`/requests`, {}, fetch)
      .then((res) => {
        incomingRequests = res.data.incoming || [];
        outgoingRequests = res.data.outgoing || [];
        reports = res.data.reports || null;
      })
      .catch((err) => {
        console.error("Failed to fetch requests:", err);
      });
  });
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
        {#if data.requestCounts.reports !== null}
          <Tabs.Trigger value="reports">
            Reports
            <Badge variant="outline">
              {data.requestCounts.reports}
            </Badge>
          </Tabs.Trigger>
        {/if}
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
