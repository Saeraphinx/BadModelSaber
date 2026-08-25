<script lang="ts">
  import { AssetFileFormat, RenderingModes, Status, UserPermissions, type AssetApiV3 } from "$lib/scripts/from_backend/DBExtras.js";
  import AssetCard from "$lib/components/assets/AssetCard.svelte";
  import Separator from "$shadcn/components/ui/separator/separator.svelte";
  import { ChevronRight, FunnelIcon } from "@lucide/svelte";
  import { Label } from "$shadcn/components/ui/label";
  import { Checkbox } from "$shadcn/components/ui/checkbox/index.js";
  import Input from "$shadcn/components/ui/input/input.svelte";
  import * as Select from "$shadcn/components/ui/select/index.js";
  import Button from "$shadcn/components/ui/button/button.svelte";
  import { Skeleton } from "$shadcn/components/ui/skeleton";
  import { MediaQuery } from "svelte/reactivity";
  import * as Collapsible from "$shadcn/components/ui/collapsible";
  import { generateAssetSearchEngine } from "$lib/scripts/utils/search.js";
  import { onMount, tick, untrack } from "svelte";
  import ApprovalPopup from "$lib/components/dialogs/ApprovalDialog.svelte";
  import { toast } from "svelte-sonner";
  import { getAssetTypeCategories, getRenderingMethodString, getRenderingMethodSupportedGV, getStatusString } from "$lib/scripts/utils/stylizer.js";
  import { i18n } from "$lib/scripts/i18n";

  const { t } = i18n();
  import MiniPagination from "$lib/components/generic/MiniPagination.svelte";
  import BigPagination from "$lib/components/generic/BigPagination.svelte";
  import { checkAllowApproval, checkRoles, getAllowedAssetStatuses } from "$lib/scripts/utils/checkRoles.js";
  import * as Drawer from "$shadcn/components/ui/drawer";
  import { parseErrorMessage } from "../../lib/scripts/utils/api.js";
  import * as RadioGroup from "../../lib/shadcn/components/ui/radio-group";
  import { navigating, page } from "$app/state";
  import { replaceState } from "$app/navigation";

  const { data: _internal } = $props();
  // svelte-ignore state_referenced_locally
  const { trpc, user, pageData: initQuery } = $derived(_internal);
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
  let filterRenderingMethodVisible = $state<boolean>(true);
  let filterMobileDrawerVisible = $state<boolean>(false);
  // svelte-ignore state_referenced_locally
  let selectedFileFormats = $state<AssetFileFormat[]>(initQuery.fileFormat && initQuery.fileFormat.every(ff => ff !== `all`) ? initQuery.fileFormat : []);
  // svelte-ignore state_referenced_locally
  let selectedStatuses = $state<Status[]>(initQuery.status ? [initQuery.status] : [Status.Verified]);
  // svelte-ignore state_referenced_locally
  let selectedRenderingMethod = $state<RenderingModes | `all`>(initQuery.renderingMethod ? initQuery.renderingMethod : `all`);
  // svelte-ignore state_referenced_locally
  let searchQuery = $state<string>(initQuery.searchQuery || ``);
  let assetStatuses = $derived.by(() => getAllowedAssetStatuses(user, false, `beatsaber`));

  // Filters Themselves
  let filteredAssets: AssetApiV3[] = $derived.by(() => {
    // Filter Only
    if (!assetArray || assetArray.length === 0) return [];

    let searchOut = searchQuery.length >= 1 ? searchEngine?.search(searchQuery) || assetArray : assetArray;

    return searchOut.filter((asset) => {
      let matchesFormat = selectedFileFormats.length === 0 || selectedFileFormats.includes(asset.type);
      let matchesStatus = selectedStatuses.length === 0 || selectedStatuses.includes(asset.status);
      let matchesRenderingMethod = selectedRenderingMethod === `all` || asset.renderingMethod === selectedRenderingMethod;
      return matchesFormat && matchesStatus && matchesRenderingMethod;
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
        toast.error(t(`toasts.failedTo.loadAssets`), {
          description: parseErrorMessage(error),
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

  $effect(() => {
    //update url based on filters

    let searchParams = new URLSearchParams();
    if (selectedFileFormats.length > 0) {
      searchParams.set("type", selectedFileFormats.join(","));
    }
    if (selectedRenderingMethod !== `all`) {
      searchParams.set("renderingMethod", selectedRenderingMethod);
    }
    if (selectedStatuses.length > 0 && !(selectedStatuses.length === 1 && selectedStatuses[0] === Status.Verified)) {
      searchParams.set("status", selectedStatuses[0]);
    }
    if (searchQuery.length > 0) {
      searchParams.set("search", searchQuery);
    }
    untrack(() => tick().then(() =>replaceState(`${location.pathname}${searchParams.size > 0 ? `?${searchParams.toString()}` : ""}`, page.state)));
  });
</script>

{#snippet filters()}
  <!-- File Type Filter -->
  <Collapsible.Root bind:open={filterFileFormatVisible}>
    <div class="flex flex-col bg-card rounded-2xl min-w-62 w-full py-2 px-4">
      <Collapsible.Trigger class="flex items-center justify-between w-full">
        <span class="text-lg font-semibold">{t(`common.dataTable.type`)}</span>
        <ChevronRight class="h-4 w-4 transition-transform {filterFileFormatVisible ? `rotate-90` : ``}" />
      </Collapsible.Trigger>
      <Collapsible.Content class="my-2">
        {#each getAssetTypeCategories(t) as type}
          <div class="pt-1">
            <span class="font-medium my-2">{type[0]}</span>
            <Separator class="my-1" />
            {#each type[1] as format}
              <div class="flex items-center space-x-2 py-1">
                <Checkbox
                  checked={selectedFileFormats.includes(format.rawString)}
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
  <!-- render mode Filter -->
  <Collapsible.Root bind:open={filterRenderingMethodVisible} class="mt-4">
    <div class="flex flex-col bg-card rounded-2xl min-w-62 w-full py-2 px-4">
      <Collapsible.Trigger class="flex items-center justify-between w-full">
        <span class="text-lg font-semibold">{t(`common.dataTable.renderingMethod`)}</span>
        <ChevronRight class="h-4 w-4 transition-transform {filterRenderingMethodVisible ? `rotate-90` : ``}" />
      </Collapsible.Trigger>
      <Collapsible.Content class="my-2">
        <RadioGroup.Root bind:value={selectedRenderingMethod} class="flex flex-col">
          {#each Object.entries(RenderingModes) as mode}
            {#if mode[1] !== RenderingModes.Unknown}
            <div class="flex items-center space-x-2">
              <RadioGroup.Item value={mode[1]} id={mode[1]} />
              <span class="flex flex-col">
                <Label for={mode[1]}>
                  {getRenderingMethodString(t, mode[1])}
                </Label>
                  <p class="text-xs text-gray-400">For {getRenderingMethodSupportedGV(mode[1])}</p>
              </span>
            </div>
            {/if}
          {/each}
          <div class="flex items-center space-x-2">
            <RadioGroup.Item value="all" id="all" />
            <Label for="all">
              {t(`common.all`)}
            </Label>
          </div>
        </RadioGroup.Root>
      </Collapsible.Content>
    </div>
  </Collapsible.Root>
  {#if assetStatuses.length > 1}
    <!-- Only show status filter if there are multiple statuses available for filtering -->
    <Collapsible.Root bind:open={filterStatusVisible} class="mt-4">
      <div class="flex flex-col bg-card rounded-2xl min-w-62 w-full py-2 px-4">
        <Collapsible.Trigger class="flex items-center justify-between w-full">
          <span class="text-lg font-semibold">{t(`common.dataTable.status`)}</span>
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
              <Label for={status}>{getStatusString(t, status)}</Label>
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
      <Label for="asset-search" class="sr-only">{t(`search.search`)}</Label>
      <Input type="text" placeholder={t(`search.searchAssets`)} id="asset-search" bind:value={searchQuery} />
      {#if full}
        <Button variant="outline" onclick={() => (filterMobileDrawerVisible = true)}>
          <FunnelIcon class="h-4 w-4" />
          <span class="sr-only">{t(`search.showFilters`)}</span>
        </Button>
      {/if}
    </div>
    <div class="flex flex-row flex-wrap gap-2">
      <div class="grid grid-cols-[1fr_1.75fr] w-full items-center gap-2">
        <Label for="per-page-select" class="text-sm">{t(`search.cardsPerPage`)}</Label>
        <Select.Root allowDeselect={false} bind:value={selectedPageSizeString} type="single" onValueChange={(value) => (currentPage = 1)}>
          <Select.Trigger id="per-page-select" class="w-full">{t(`search.perPage`, { count: selectedPageSizeString })}</Select.Trigger>
          <Select.Content>
            {#each [24, 48, 72] as amount}
              <Select.Item value={amount.toString()}>
                {t(`search.perPage`, { count: amount })}
              </Select.Item>
            {/each}
          </Select.Content>
        </Select.Root>
        <Label for="size-select" class="text-sm">{t(`search.size`)}</Label>
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
            <span class="text-gray-500 dark:text-gray-400 w-full py-8 text-center">{t(`assets.noAssetsFound`)}</span>
          {/if}
          {#each currentAssetArray as asset (asset.id)}
            <AssetCard {asset} approvalDialog={checkAllowApproval(user, asset) ? dialog : undefined} size={selectedCardSize} />
          {/each}
        {/if}
      </div>
      <Separator class="my-4 w-full" />
      <div class="mb-4">
        {#if !smallerIcons.current}
          <BigPagination {selectedPageSize} bind:currentPage totalItems={filteredAssets.length} />
        {:else}
          <MiniPagination {selectedPageSize} bind:currentPage totalCount={filteredAssets.length} />
        {/if}
      </div>
    </div>
  </div>
</div>

<ApprovalPopup bind:this={dialog} />
<Drawer.Root bind:open={filterMobileDrawerVisible}>
  <Drawer.Content>
    <div class="overflow-y-auto h-full pr-4">
      {@render filters()}
    </div>
  </Drawer.Content>
</Drawer.Root>
