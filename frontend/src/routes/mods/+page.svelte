<script lang="ts">
  import MiniPagination from "$lib/components/generic/MiniPagination.svelte";
  import ModCard from "$lib/components/mods/ModCard.svelte";
  import { m } from "$lib/paraglide/messages.js";
  import { Status, type ElementType, type GameVersionApiV3 } from "$lib/scripts/api/DBTypes";
  import { generateProjectSearchEngine } from "$lib/scripts/utils/search.js";
  import { getStatusString } from "$lib/scripts/utils/stylizer";
  import Checkbox from "$shadcn/components/ui/checkbox/checkbox.svelte";
  import * as Collapsible from "$shadcn/components/ui/collapsible";
  import Input from "$shadcn/components/ui/input/input.svelte";
  import Label from "$shadcn/components/ui/label/label.svelte";
  import * as Select from "$shadcn/components/ui/select";
  import Skeleton from "$shadcn/components/ui/skeleton/skeleton.svelte";
  import { ChevronRightIcon, FunnelIcon } from "@lucide/svelte";
  import { onMount } from "svelte";
  import { MediaQuery } from "svelte/reactivity";
  import { Button } from "../../lib/shadcn/components/ui/button";

  const { data: _internal } = $props();
  const { pageData, trpc } = $derived(_internal);
  let tooSmall = new MediaQuery("max-width: 768px");

  let isLoading = $state(true);
  const games = $derived(pageData.games);
  // svelte-ignore state_referenced_locally
  let selectedGameName = $state<string>(pageData.defaultGame.game.name || ``);
  // svelte-ignore state_referenced_locally
  let selectedGame = $derived.by(() => games?.find((g) => g.name === selectedGameName));
  // svelte-ignore state_referenced_locally
  let gameVerisions: GameVersionApiV3[] = $state(pageData.defaultGame.gameVersions || []);
  let selectedGameVersionId = $state<string>(``);
  let selectedGameVersion = $derived.by(() => gameVerisions.find((v) => v.id === parseInt(selectedGameVersionId)));

  let isFilterStatusVisible = $state(true);
  let isFilterCategoryVisible = $state(true);
  let searchEngine = $state<ReturnType<typeof generateProjectSearchEngine>>();
  let searchQuery = $state("");
  let currentPage = $state(1);
  let pageSize = $state(20);
  // svelte-ignore non_reactive_update
  let totalUnfilteredSize = $derived(searchEngine?.mods.size || -1);
  let selectedStatuses = $state<Status[]>([Status.Verified]);
  let selectedCategories = $state<string[]>([]);
  let filteredMods = $derived.by(() => {
    if (!searchEngine) return [];
    //debugger;
    let searchResults = searchQuery.trim() !== "" ? searchEngine.search(searchQuery) : Array.from(searchEngine.mods.values());
    searchResults = searchResults.filter((result) => {
      if (selectedStatuses && selectedStatuses.length !== 0 && !selectedStatuses.includes(result.project.status)) return false;
      if (selectedCategories && selectedCategories.length !== 0 && !selectedCategories.some((category) => category == result.project.category)) return false;
      return true;
    });
    return searchResults;
  });
  let totalSize = $derived(filteredMods.length);
  let availableStatuses: Status[] = $derived.by(() => Array.from(new Set(Array.from(searchEngine?.mods.values() || []).map((result) => result.version.status))));
  let filterModsPageView = $derived.by(() => {
    let startIndex = (currentPage - 1) * pageSize;
    let endIndex = startIndex + pageSize;
    return filteredMods.slice(startIndex, endIndex);
  });

  async function fetchMods() {
    if (!selectedGame) return;
    isLoading = true;
    let mods = await trpc.v3.mods.getMods.query({
      gameName: selectedGame.name,
      gameVersion: selectedGameVersion ? selectedGameVersion.version : undefined,
    });
    searchEngine = generateProjectSearchEngine(mods);
    isLoading = false;
    return mods;
  }

  onMount(async () => {
    isLoading = true;
    fetchMods();
  });
</script>

{#snippet searchFilter()}
  <div class="flex flex-col bg-card gap-2 p-4 rounded-md">
    <div class="flex flex-row w-full gap-2">
      <Input bind:value={searchQuery} placeholder="Search..." />
      {#if tooSmall.current}
        <Button variant="outline">
          <FunnelIcon class="h-4 w-4" />
          <span class="sr-only">{m["search.showFilters"]()}</span>
        </Button>
      {/if}
    </div>
    <div class="flex flex-col justify-center items-center">
      <MiniPagination bind:totalCount={totalSize} bind:selectedPageSize={pageSize} bind:currentPage={currentPage} />
      <p class="text-sm text-muted-foreground">{totalUnfilteredSize} total mods</p>
    </div>
  </div>
{/snippet}

{#snippet gameFilter()}
  <div class="flex flex-col bg-card gap-4 p-4 rounded-md">
    <span>
      <Label class="pb-2 px-1">{m[`mods.game`]()}</Label>
      <Select.Root type="single" bind:value={selectedGameName} onValueChange={fetchMods}>
        <Select.Trigger class="w-full">{selectedGame?.displayName}</Select.Trigger>
        <Select.Content>
          {#each games as game}
            <Select.Item value={game.name}>{game.displayName}</Select.Item>
          {/each}
        </Select.Content>
      </Select.Root>
    </span>
    {#if selectedGame}
      <span>
        <Label class="pb-2 px-1">{m[`mods.gameVersion`]()}</Label>
        <Select.Root type="single" bind:value={selectedGameVersionId} onValueChange={fetchMods}>
          <Select.Trigger class="w-full">{selectedGameVersion?.version || `All`}</Select.Trigger>
          <Select.Content>
            {#each gameVerisions as version}
              <Select.Item value={version.id.toString()}>{version.version}</Select.Item>
            {/each}
          </Select.Content>
        </Select.Root>
      </span>
    {/if}
  </div>
{/snippet}

{#snippet statusFilter()}
  <Collapsible.Root bind:open={isFilterStatusVisible}>
    <div class="flex flex-col bg-card rounded-md min-w-60 w-full py-2 px-4">
      <Collapsible.Trigger class="flex items-center justify-between w-full">
        <span class="text-lg font-semibold">{m["mods.dataTable.status"]()}</span>
        <ChevronRightIcon class="h-4 w-4 transition-transform {isFilterStatusVisible ? `rotate-90` : ``}" />
      </Collapsible.Trigger>
      <Collapsible.Content class="my-2">
        {#each availableStatuses as status}
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
{/snippet}

{#snippet categoryFilter()}
  <Collapsible.Root bind:open={isFilterCategoryVisible}>
    <div class="flex flex-col bg-card rounded-md min-w-60 w-full py-2 px-4">
      <Collapsible.Trigger class="flex items-center justify-between w-full">
        <span class="text-lg font-semibold">{m["mods.dataTable.category"]()}</span>
        <ChevronRightIcon class="h-4 w-4 transition-transform {isFilterStatusVisible ? `rotate-90` : ``}" />
      </Collapsible.Trigger>
      <Collapsible.Content class="my-2">
        {#each selectedGame?.categories as category}
          <div class="flex items-center space-x-2 py-1">
            <Checkbox
              onCheckedChange={(e) => {
                if (e) {
                  selectedCategories.push(category);
                  selectedCategories = [...new Set(selectedCategories)]; // Ensure uniqueness & force reactivity
                } else {
                  selectedCategories = selectedCategories.filter((f) => f !== category);
                }
              }}
              checked={selectedCategories.includes(category)}
              value={category}
              id={category} />
            <Label for={category}>{category}</Label>
          </div>
        {/each}
      </Collapsible.Content>
    </div>
  </Collapsible.Root>
{/snippet}

<div class="flex flex-row not-sm:flex-col gap-4 m-auto max-w-[95%] not-sm:mb-4">
  <!-- left filter/search bar -->
  {#if !tooSmall.current}
    <div class="flex flex-col w-64 gap-2">
      {@render gameFilter()}
      {@render searchFilter()}
      {@render statusFilter()}
      {@render categoryFilter()}
    </div>
  {:else}
    <div class="flex flex-col w-full gap-2">
      {@render gameFilter()}
      {@render searchFilter()}
    </div>
  {/if}
  <!-- right content area -->
  <div class="flex-1 gap-4 flex flex-row flex-wrap items-center-safe justify-center-safe">
    {#if !isLoading}
      {#each filterModsPageView as mod}
        <ModCard project={mod.project} version={mod.version} gameDisplayName={selectedGame?.displayName} />
      {/each}
    {:else}
      {#each { length: pageSize }}
        <Skeleton class="w-sm h-48 rounded-md" />
      {/each}
    {/if}
  </div>
  {#if tooSmall.current}
    <div class="flex flex-col w-full gap-2">
      {@render searchFilter()}
    </div>
  {/if}
</div>
