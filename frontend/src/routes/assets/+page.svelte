<script lang="ts">
  import { AssetFileFormat, Status, UserPermissions, type AssetApiV3 } from "$lib/scripts/api/DBTypes";
  import AssetCard from "$lib/components/assets/AssetCard.svelte";
  import * as RadioGroup from "$shadcn/components/ui/radio-group/index.js";
  import * as Pagination from "$shadcn/components/ui/pagination";
  import Separator from "$shadcn/components/ui/separator/separator.svelte";
  import * as Tabs from "$shadcn/components/ui/tabs/index.js";
  import { ChevronLeft, ChevronRight, FunnelIcon } from "@lucide/svelte";
  import { Label } from "$shadcn/components/ui/label";
  import { Checkbox } from "$shadcn/components/ui/checkbox/index.js";
  import Input from "$shadcn/components/ui/input/input.svelte";
  import { DropdownMenu } from "$shadcn/components/ui/dropdown-menu";
  import * as Select from "$shadcn/components/ui/select/index.js";
  import Button from "$shadcn/components/ui/button/button.svelte";
  import { Skeleton } from "$shadcn/components/ui/skeleton";
  import { MediaQuery } from "svelte/reactivity";
  import * as Collapsible from "$shadcn/components/ui/collapsible";
  import { generateAssetSearchEngine } from "$lib/scripts/utils/search.js";
  import { getContext, onMount } from "svelte";
  import ApprovalPopup from "$lib/components/dialogs/ApprovalDialog.svelte";
  import { toast } from "svelte-sonner";
  import { getAssetTypeCategories, getStatusString } from "$lib/scripts/utils/stylizer.js";
  import { m } from "$lib/paraglide/messages.js";
  import MiniPagination from "$lib/components/generic/MiniPagination.svelte";
  import BigPagination from "$lib/components/generic/BigPagination.svelte";
  import { checkRoles } from "$lib/scripts/utils/checkRoles.js";
  import * as Drawer from "$shadcn/components/ui/drawer";

  const { data: _internal } = $props();
  // svelte-ignore state_referenced_locally
  const { trpc, user } = $derived(_internal);
  // Generic Page Data
  let smallerIcons = new MediaQuery("max-width: 1000px");
  let tooSmall = new MediaQuery("max-width: 768px");

  // Asset Data
  let assetsLoading = $state(false);
  let assetArray = $state<AssetApiV3[]>([]);
  let searchEngine = $state<ReturnType<typeof generateAssetSearchEngine>>();
  let dialog = $state<ApprovalPopup>();

  // Pagenation & View Data
  let currentPage = $state(1);
  let selectedPageSizeString = $state(`24`);
  let selectedPageSize = $derived(Number(selectedPageSizeString));
  let selectedCardSize = $state<"linked" | "normal" | "large" | "small">(tooSmall.current ? `normal` : `large`);

  // Filter Data
  let filterFileFormatVisible = $state<boolean>(true);
  let filterStatusVisible = $state<boolean>(true);
  let filterMobileDrawerVisible = $state<boolean>(false);
  let selectedFileFormats = $state<AssetFileFormat[]>([]);
  let selectedStatuses = $state<Status[]>([Status.Verified]);
  let searchQuery = $state<string>("");
  let assetStatuses = $derived.by(() => {
    if (!user) return [Status.Verified, Status.Unverified];
    if (checkRoles(user, [UserPermissions.Asset_ViewAll], `any`)) {
      return Object.values(Status);
    }
    return [Status.Verified, Status.Unverified];
  });

  // Filters Themselves
  let filteredAssets: AssetApiV3[] = $derived.by(() => {
    // Filter Only
    if (!assetArray || assetArray.length === 0) return [];

    let searchOut = searchQuery.length >= 1 ? searchEngine?.search(searchQuery) || assetArray : assetArray;

    return searchOut.filter((asset) => {
      let matchesFormat = selectedFileFormats.length === 0 || selectedFileFormats.includes(asset.type);
      let matchesStatus = selectedStatuses.length === 0 || selectedStatuses.includes(asset.status);
      return matchesFormat && matchesStatus;
    });
  });
  let currentAssetArray: AssetApiV3[] = $derived.by(() => {
    // Filter + Pagination
    if (!filteredAssets || filteredAssets.length === 0) return [];
    let start = (currentPage - 1) * selectedPageSize;
    return filteredAssets.slice(start, start + selectedPageSize);
  });

  // Asset Fetch
  async function fetchAssets() {
    assetsLoading = true;
    let assets = await trpc.v3.assets.getAssets
      .query({})
      .then((response) => {
        return response.assets;
      })
      .catch((error) => {
        console.error("Error fetching assets:", error);
        toast.error(m["toasts.failedToLoadAsset"](), {
          description: `${error.message || "Unknown error"}`,
          closeButton: true,
          duration: 30000,
        });
        return undefined;
      });

    assetArray = assets ?? [];
    searchEngine = generateAssetSearchEngine(assets ?? []);
    assetsLoading = false;
  }

  onMount(() => {
    fetchAssets();
  });
</script>

{#snippet filters()}
  <!-- File Type Filter -->
  <Collapsible.Root bind:open={filterFileFormatVisible}>
    <div class="flex flex-col bg-card rounded-2xl min-w-62 w-full py-2 px-4">
      <Collapsible.Trigger class="flex items-center justify-between w-full">
        <span class="text-lg font-semibold">{m["assets.dataTable.type"]()}</span>
        <ChevronRight class="h-4 w-4 transition-transform {filterFileFormatVisible ? `rotate-90` : ``}" />
      </Collapsible.Trigger>
      <Collapsible.Content class="my-2">
        {#each getAssetTypeCategories() as type}
          <div class="pt-1">
            <span class="font-medium my-2">{type[0]}</span>
            <Separator class="my-1" />
            {#each type[1] as format}
              <div class="flex items-center space-x-2 py-1">
                <Checkbox
                  onCheckedChange={(e) => {
                    if (e) {
                      selectedFileFormats.push(format.rawString);
                      selectedFileFormats = [...new Set(selectedFileFormats)]; // Ensure uniqueness & force reactivity
                    } else {
                      selectedFileFormats = selectedFileFormats.filter((f) => f !== format.rawString);
                    }
                  }}
                  value={format.rawString}
                  id={format.rawString} />
                {#if type[0] == `Configs` || type[0] == `Other`}
                  <Label for={format.rawString}>{format.combinedString}</Label>
                {:else}
                  <Label for={format.rawString}>{format.formatString}</Label>
                {/if}
              </div>
            {/each}
          </div>
        {/each}
      </Collapsible.Content>
    </div>
  </Collapsible.Root>
  {#if assetStatuses.length > 1}
    <!-- Only show status filter if there are multiple statuses available for filtering -->
    <Collapsible.Root bind:open={filterStatusVisible} class="mt-4">
      <div class="flex flex-col bg-card rounded-2xl min-w-62 w-full py-2 px-4">
        <Collapsible.Trigger class="flex items-center justify-between w-full">
          <span class="text-lg font-semibold">{m["assets.dataTable.status"]()}</span>
          <ChevronRight class="h-4 w-4 transition-transform {filterStatusVisible ? `rotate-90` : ``}" />
        </Collapsible.Trigger>
        <Collapsible.Content class="my-2">
          {#each assetStatuses as status}
            <div class="flex items-center space-x-2 py-1">
              <Checkbox
                onCheckedChange={(e) => {
                  if (e) {
                    selectedStatuses.push(status);
                    selectedStatuses = [...new Set(selectedStatuses)]; // Ensure uniqueness & force reactivity
                  } else {
                    selectedStatuses = selectedStatuses.filter((f) => f !== status);
                  }
                }}
                checked={selectedStatuses.includes(status)}
                value={status}
                id={status} />
              <Label for={status}>{getStatusString(status)}</Label>
            </div>
          {/each}
        </Collapsible.Content>
      </div>
    </Collapsible.Root>
  {/if}
{/snippet}

{#snippet search(full = false)}
  <div class="flex flex-col bg-card rounded-2xl {full ? `max-w-md w-full` : `w-62`} p-4 mb-4 gap-2">
    <div class="flex flex-row w-full gap-2">
      <Label for="asset-search" class="sr-only">{m["search.search"]()}</Label>
      <Input type="text" placeholder={m["search.searchAssets"]()} id="asset-search" bind:value={searchQuery} />
      {#if full}
        <Button variant="outline" onclick={() => (filterMobileDrawerVisible = true)}>
          <FunnelIcon class="h-4 w-4" />
          <span class="sr-only">{m["search.showFilters"]()}</span>
        </Button>
      {/if}
    </div>
    <div class="flex flex-row flex-wrap gap-2">
      <div class="grid grid-cols-[1fr_1.75fr] w-full items-center gap-2">
        <Label for="per-page-select" class="text-sm">{m["search.cardsPerPage"]()}</Label>
        <Select.Root allowDeselect={false} bind:value={selectedPageSizeString} type="single" onValueChange={(value) => (currentPage = 1)}>
          <Select.Trigger id="per-page-select" class="w-full">{m["search.perPage"]({ count: selectedPageSizeString })}</Select.Trigger>
          <Select.Content>
            {#each [24, 48, 72] as amount}
              <Select.Item value={amount.toString()}>
                {m["search.perPage"]({ count: amount })}
              </Select.Item>
            {/each}
          </Select.Content>
        </Select.Root>
        <Label for="size-select" class="text-sm">{m["search.size"]()}</Label>
        <Select.Root allowDeselect={false} bind:value={selectedCardSize} type="single" onValueChange={(value) => (currentPage = 1)}>
          <Select.Trigger id="size-select" class="w-full capitalize">{selectedCardSize}</Select.Trigger>
          <Select.Content>
            {#each [`linked`, `small`, `normal`, `large`] as size}
              <Select.Item class="capitalize" value={size.toString()}>
                {size}
              </Select.Item>
            {/each}
          </Select.Content>
        </Select.Root>
      </div>
      <div class="flex-1 flex {full ? `justify-end` : `justify-center`}">
        <MiniPagination {selectedPageSize} bind:currentPage totalCount={filteredAssets.length} />
      </div>
    </div>
  </div>
{/snippet}

<div class="flex flex-col items-center w-[90%] not-lg:w-full m-auto px-4 not-md:p-0 rounded-2xl">
  <div class="flex flex-row w-full">
    <!-- Filter Area -->
    {#if !tooSmall.current}
      <div class="flex flex-col items-start mb-4 mr-4 whitespace-nowrap">
        {@render search(false)}
        {@render filters()}
      </div>      
    {/if}
    <!-- Content -->
    <div class="flex flex-col items-center w-full">
      {#if tooSmall.current}
        {@render search(true)}
       {/if}
      <!-- Cards -->
      <div class="flex flex-row flex-wrap justify-evenly gap-4">
        {#if assetsLoading}
          {#each { length: selectedPageSize }}
            <Skeleton class="bg-gray-400/20 {smallerIcons.current ? `w-48 h-48` : `w-64 h-64`} rounded-2xl" />
          {/each}
        {:else}
          {#if filteredAssets.length === 0}
            <span class="text-gray-500 dark:text-gray-400 w-full py-8 text-center">{m["assets.noAssetsFound"]()}</span>
          {/if}
          {#each currentAssetArray as asset (asset.id)}
            <AssetCard {asset} approvalDialog={checkRoles(user, [UserPermissions.Asset_Approval], asset.gameName) ? dialog : undefined} size={selectedCardSize} />
          {/each}
        {/if}
      </div>
      <Separator class="my-4 w-full" />
      {#if !smallerIcons.current}
        <BigPagination {selectedPageSize} bind:currentPage totalItems={filteredAssets.length} />
      {:else}
        <MiniPagination {selectedPageSize} bind:currentPage totalCount={filteredAssets.length} />
      {/if}
    </div>
  </div>
</div>

<ApprovalPopup bind:this={dialog} />
<Drawer.Root bind:open={filterMobileDrawerVisible}>
  <Drawer.Header>{m["search.filters"]}</Drawer.Header>
  <Drawer.Content>
    <div class="overflow-y-auto h-full pr-4">
      {@render filters()}
    </div>
  </Drawer.Content>
</Drawer.Root>
