<script lang="ts">
  import RequestCard from "$lib/components/requests/RequestCard.svelte";
  import { RequestType, type ThingRequestApiV3 } from "$lib/scripts/from_backend/DBExtras.js";
  import Badge from "$shadcn/components/ui/badge/badge.svelte";
  import * as Tabs from "$shadcn/components/ui/tabs/index.js";
  import { onMount } from "svelte";
  import { UserPermissions } from "$lib/scripts/from_backend/DBExtras.js";
  import Button from "$shadcn/components/ui/button/button.svelte";
  import { RefreshCwIcon } from "@lucide/svelte";
  import { checkRoles } from "$lib/scripts/utils/checkRoles.js";
  import * as Select from "$shadcn/components/ui/select/index.js";
  import { Label } from "../../lib/shadcn/components/ui/label";
  import { toast } from "svelte-sonner";
  import { parseErrorMessage } from "../../lib/scripts/utils/api";

  let { data: _internal } = $props();
  const { requestCounts, trpc, user } = $derived(_internal);

  let incomingRequests: ThingRequestApiV3[] = $state([]);
  let outgoingRequests: ThingRequestApiV3[] = $state([]);
  let reports: ThingRequestApiV3[] = $state([]);
  let isLoading = $state(true);

  onMount(() => {
    getRequests();
  });

  async function getRequests() {
    isLoading = true;
    await trpc.internal.requests.getMyRequests
      .query({})
      .then((res) => {
        incomingRequests = res.incoming || [];
        outgoingRequests = res.outgoing || [];
        isLoading = false;
      })
      .catch((err) => {
        console.error("Failed to fetch requests:", err);
        isLoading = false;
      });
  }

  let reportsGameName: string | undefined = $state(undefined);
  let reportsRequestType: RequestType | undefined = $state(undefined);
  let includeNonReports: boolean = $state(false);
  let includeActioned: boolean = $state(false);
  async function getReports() {
    isLoading = true;
    await trpc.internal.requests.getAllRequests
      .query({
        gameName: reportsGameName,
        requestType: reportsRequestType,
        includeActioned: includeActioned,
        includeSpecificResponseBy: includeNonReports,
      })
      .then((reps) => {
        reports = reps;
        isLoading = false;
        toast.success("Reports fetched successfully.");
      })
      .catch((err) => {
        console.error("Failed to fetch reports:", err);
        toast.error("Failed to fetch reports.", { description: parseErrorMessage(err) });
        isLoading = false;
      });
  }
</script>

{#snippet requestCards(requests: ThingRequestApiV3[])}
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
  <Tabs.Root class="w-full items-center" value="admin">
    <Tabs.List>
      <Tabs.Trigger value="outgoing">
        My Outgoing Requests
        <Badge variant="outline">
          {requestCounts.outgoing}
        </Badge>
      </Tabs.Trigger>
      <Tabs.Trigger value="incoming">
        Incoming Requests
        <Badge variant="outline">
          {requestCounts.incoming}
        </Badge>
      </Tabs.Trigger>
      {#if checkRoles(user, { hasOneOf: [UserPermissions.Requests_ViewAll, UserPermissions.Requests_ViewAssets, UserPermissions.Requests_ViewUsers, UserPermissions.Requests_ManageAll] }, `any`)}
        <Tabs.Trigger value="admin">
          Reports
          <!-- <Badge variant="outline">
            {reports.length}
          </Badge> -->
        </Tabs.Trigger>
      {/if}
      <Button
        variant="ghost"
        size="icon"
        disabled={isLoading}
        onclick={() => {
          document.getElementById("refreshIcon")?.classList.add("animate-spin");
          getRequests().then(() => {
            document.getElementById("refreshIcon")?.classList.remove("animate-spin");
          });
        }}><RefreshCwIcon id="refreshIcon" class="transition-all duration-300" /></Button>
    </Tabs.List>
    <Tabs.Content value="outgoing">
      {@render requestCards(outgoingRequests)}
    </Tabs.Content>
    <Tabs.Content value="incoming">
      {@render requestCards(incomingRequests)}
    </Tabs.Content>
    <Tabs.Content value="admin">
      <div class="flex flex-col items-center justify-center bg-accent p-4 gap-2 rounded-lg">
        <div class="grid grid-cols-[1fr_1.5fr] gap-2 gap-x-8 justify-center items-center w-full">
          <p class="text-base">Request Type</p>
          <Select.Root type="single" bind:value={reportsRequestType}>
            <Select.Trigger class="w-full">{reportsRequestType}</Select.Trigger>
            <Select.Content>
              {#each Object.values(RequestType) as type}
                <Select.Item value={type}>{type}</Select.Item>
              {/each}
            </Select.Content>
          </Select.Root>
          <p class="text-base">Game Name</p>
          <Select.Root type="single" bind:value={reportsGameName}>
            <Select.Trigger class="w-full">{reportsGameName}</Select.Trigger>
            <Select.Content>
              {#await trpc.v3.games.getGames.query() then gameNames}
                {#each gameNames as gameName}
                  <Select.Item value={gameName.name}>{gameName.displayName}</Select.Item>
                {/each}
              {/await}
            </Select.Content>
          </Select.Root>
          <div class="flex justify-center items-center space-x-2">
            <input type="checkbox" bind:checked={includeActioned} />
            <Label class="text-base">Include Actioned</Label>
          </div>
          <div class="flex justify-center items-center space-x-2">
            <input type="checkbox" bind:checked={includeNonReports} />
            <Label class="text-base">Include Non-Reports</Label>
          </div>
        </div>
        <Button variant="default" class="w-full" onclick={getReports}>Get Reports</Button>
      </div>
      <div class="flex flex-col gap-4 mt-4 justify-center items-center">
        {@render requestCards(reports)}
      </div>
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
