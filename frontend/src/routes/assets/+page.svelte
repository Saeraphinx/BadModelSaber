<script lang="ts">
  import { AssetFileFormat, Status, UserPermissions, type AssetPublicAPIv3 } from "$lib/scripts/api/DBTypes";
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
  import ApprovalPopup from "$lib/components/assets/ApprovalDialog.svelte";
  import { fetchApiSafe } from "$lib/scripts/utils/api.js";
  import { toast } from "svelte-sonner";
  import { capitalizeFirstLetter, getAssetTypeString } from "$lib/scripts/utils/stylizer.js";

  let { data } = $props();
  // Generic Page Data
  let smallerIcons = new MediaQuery("max-width: 1000px");
  let tooSmall = new MediaQuery("max-width: 768px");

  // Asset Data
  let assetsLoading = $state(false);
  let assetArray = $state<AssetPublicAPIv3[]>([]);
  let searchEngine = $state<ReturnType<typeof generateAssetSearchEngine>>();
  let dialog = $state<ApprovalPopup>();

  // Pagenation
  let currentPage = $state(1);
  let selectedPageSizeString = $state(`24`);
  let selectedPageSize = $derived(Number(selectedPageSizeString));

  // Filter Data
  let filterFileFormatVisible = $state<boolean>(true);
  let filterStatusVisible = $state<boolean>(true);
  let selectedFileFormats = $state<AssetFileFormat[]>([]);
  let selectedStatuses = $state<Status[]>([Status.Approved]);
  let searchQuery = $state<string>("");
  let assetFileFormats = $derived.by(() => {
    return Object.values(AssetFileFormat).map((format) => {
      let type = format.split("_")[0];
      return {
        value: format,
        label: getAssetTypeString(format),
      };
    });
  });
  let assetStatuses = $derived.by(() => {
    if (!data.user) return [Status.Approved];
    if (data.user.roles.includes(UserPermissions.View_All_Assets)) {
      return Object.values(Status);
    }
    return data.user.roles.includes(UserPermissions.View_Pending_Assets) ? [Status.Approved, Status.Pending] : [Status.Approved];
  });

  // Filters Themselves
  let filteredAssets = $derived.by(() => { // Filter Only
    if (!assetArray || assetArray.length === 0) return [];

    let searchOut = searchQuery.length >= 1 ? searchEngine?.search(searchQuery) || assetArray : assetArray;

    return searchOut.filter((asset) => {
      let matchesFormat = selectedFileFormats.length === 0 || selectedFileFormats.includes(asset.type);
      let matchesStatus = selectedStatuses.length === 0 || selectedStatuses.includes(asset.status);
      return matchesFormat && matchesStatus;
    });
  });
  let currentAssetArray = $derived.by(() => { // Filter + Pagination
    if (!filteredAssets || filteredAssets.length === 0) return [];
    let start = (currentPage - 1) * selectedPageSize;
    return filteredAssets.slice(start, start + selectedPageSize);
  });

  // Asset Fetch
  async function fetchAssets() {
    assetsLoading = true;
    let assets = await fetchApiSafe<{ assets: AssetPublicAPIv3[] }>(`/assets`, {}, data.fetch)
      .then((response) => {
        if (response.isError) {
          return;
        }
        return response.data.assets;
      })
      .catch((error) => {
        console.error("Error fetching assets:", error);
        toast.error("Failed to load assets. Please try again later.", {
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

{#snippet pagination()}
  <Pagination.Root
    count={assetArray.length}
    perPage={selectedPageSize}
    bind:page={currentPage}
    onPageChange={() => {
      window.scrollTo({ top: 0, behavior: "smooth" });
    }}>
    {#snippet children({ pages, currentPage })}
      <Pagination.Content>
        <Pagination.Item>
          <Pagination.PrevButton />
        </Pagination.Item>
        {#each pages as page (page.key)}
          {#if page.type === "ellipsis"}
            <Pagination.Item>
              <Pagination.Ellipsis />
            </Pagination.Item>
          {:else}
            <Pagination.Item>
              <Pagination.Link {page} isActive={currentPage === page.value}>
                {page.value}
              </Pagination.Link>
            </Pagination.Item>
          {/if}
        {/each}
        <Pagination.Item>
          <Pagination.NextButton />
        </Pagination.Item>
      </Pagination.Content>
    {/snippet}
  </Pagination.Root>
{/snippet}

{#snippet miniPagination()}
  <div class="flex flex-row items-center">
    <Button variant="outline" size="icon" onclick={() => (currentPage > 1 ? currentPage-- : null)}>
      <ChevronLeft class="h-4 w-4" />
    </Button>
    <span class="text-sm whitespace-nowrap mx-2">{(currentPage - 1) * selectedPageSize + 1}-{selectedPageSize * currentPage > filteredAssets.length ? filteredAssets.length : selectedPageSize * currentPage} of {filteredAssets.length}</span>
    <Button variant="outline" size="icon" onclick={() => currentPage++}>
      <ChevronRight class="h-4 w-4" />
    </Button>
  </div>
{/snippet}

{#snippet filters()}
  <!-- File Type Filter -->
  <Collapsible.Root bind:open={filterFileFormatVisible}>
    <div class="flex flex-col bg-card rounded-2xl min-w-56 w-full py-2 px-4">
      <Collapsible.Trigger class="flex items-center justify-between w-full">
        <span class="text-lg font-semibold">File Format</span>
        <ChevronRight class="h-4 w-4 transition-transform {filterFileFormatVisible ? `rotate-90` : ``}" />
      </Collapsible.Trigger>
      <Collapsible.Content class="my-2">
        {#each assetFileFormats as format}
          <div class="flex items-center space-x-2 py-1">
            <Checkbox
              onCheckedChange={(e) => {
                if (e) {
                  selectedFileFormats.push(format.value);
                  selectedFileFormats = [...new Set(selectedFileFormats)]; // Ensure uniqueness & force reactivity
                } else {
                  selectedFileFormats = selectedFileFormats.filter((f) => f !== format.value);
                }
              }}
              value={format.value}
              id={format.value} />
            <Label for={format.value}>{format.label}</Label>
          </div>
        {/each}
      </Collapsible.Content>
    </div>
  </Collapsible.Root>
  {#if assetStatuses.length > 1} <!-- Only show status filter if there are multiple statuses available for filtering -->
    <Collapsible.Root bind:open={filterStatusVisible} class="mt-4">
      <div class="flex flex-col bg-card rounded-2xl min-w-56 w-full py-2 px-4">
        <Collapsible.Trigger class="flex items-center justify-between w-full">
          <span class="text-lg font-semibold">Status</span>
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
              <Label for={status}>{capitalizeFirstLetter(status)}</Label>
            </div>
          {/each}
        </Collapsible.Content>
      </div>
    </Collapsible.Root>
  {/if}
{/snippet}

<div class="flex flex-col items-center w-[90%] not-lg:w-full m-auto p-4 rounded-2xl">
  <div class="flex flex-row w-full">
    <!-- Filter Area -->
    {#if !tooSmall.current}
      <div class="flex flex-col items-start mb-4 mr-4 whitespace-nowrap">
        {@render filters()}
      </div>
    {/if}
    <!-- Content -->
    <div class="flex flex-col items-center w-full">
      <!-- Top Bar -->
      <div class="flex flex-col bg-card rounded-2xl w-full p-4 pt-2 mb-4">
        <Label for="asset-search" class="sr-only">Search</Label>
        <Input type="text" placeholder="Search assets..." class="w-full mt-2" id="asset-search" bind:value={searchQuery} />
        <div class="flex flex-row mt-2 flex-wrap gap-2">
          <div class="flex items-center gap-2">
            <Select.Root allowDeselect={false} bind:value={selectedPageSizeString} type="single" onValueChange={(value) => (currentPage = 1)}>
              <Select.Trigger class="">{selectedPageSizeString} per page</Select.Trigger>
              <Select.Content>
                {#each [24, 48, 72] as amount}
                  <Select.Item value={amount.toString()}>
                    {amount} per page
                  </Select.Item>
                {/each}
              </Select.Content>
            </Select.Root>
          </div>
          {#if tooSmall.current}
            <Button variant="outline">
              <FunnelIcon class="h-4 w-4" />
              <span class="sr-only">Show Filters</span>
            </Button>
          {/if}
          <div class="flex-1 flex justify-end">
            {@render miniPagination()}
          </div>
        </div>
      </div>
      <!-- Cards -->
      <div class="flex flex-row flex-wrap justify-evenly gap-4 px-4">
        {#if assetsLoading}
          {#each { length: selectedPageSize }}
            <Skeleton class="bg-gray-400/20 {smallerIcons.current ? `w-48 h-48` : `w-64 h-64`} rounded-2xl" />
          {/each}
        {:else}
          {#if filteredAssets.length === 0}
            <span class="text-gray-500 dark:text-gray-400 w-full py-8 text-center">No assets found.</span>
          {/if}
          {#each currentAssetArray as asset (asset.id)}
            <AssetCard {asset} approvalDialog={data.user?.roles.includes(UserPermissions.Approve_Assets) ? dialog : undefined} size={smallerIcons.current ? `normal` : `large`} />
          {/each}
        {/if}
      </div>
      <Separator class="my-4 w-full" />
      {#if !smallerIcons.current}
        {@render pagination()}
      {:else}
        {@render miniPagination()}
      {/if}
    </div>
  </div>
</div>

<ApprovalPopup bind:this={dialog} />
