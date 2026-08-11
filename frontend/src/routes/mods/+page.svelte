<script lang="ts">
  import MiniPagination from "$lib/components/generic/MiniPagination.svelte";
  import ModCard from "$lib/components/mods/ModCard.svelte";
  import { m } from "$lib/paraglide/messages.js";
  import { Status, UserPermissions, type GameVersionApiV3, type GameVersionApiV3_full } from "$lib/scripts/from_backend/DBExtras";
  import { generateProjectSearchEngine } from "$lib/scripts/utils/search.js";
  import { getStatusString } from "$lib/scripts/utils/stylizer";
  import Checkbox from "$shadcn/components/ui/checkbox/checkbox.svelte";
  import * as Collapsible from "$shadcn/components/ui/collapsible";
  import Input from "$shadcn/components/ui/input/input.svelte";
  import Label from "$shadcn/components/ui/label/label.svelte";
  import * as Select from "$shadcn/components/ui/select";
  import Skeleton from "$shadcn/components/ui/skeleton/skeleton.svelte";
  import { ChevronRightIcon, FunnelIcon, TriangleAlertIcon } from "@lucide/svelte";
  import { sortCategoriesPublic } from "$lib/scripts/utils/stylizer";
  import { onMount, tick, untrack } from "svelte";
  import { MediaQuery } from "svelte/reactivity";
  import { Button } from "$lib/shadcn/components/ui/button";
  import { getAllowedVersionStatuses } from "$lib/scripts/utils/checkRoles";
  import * as Drawer from "../../lib/shadcn/components/ui/drawer";
  import { replaceState } from "$app/navigation";
  import { page } from "$app/state";

  const { data: _internal } = $props();
  const { pageData: {games, query, startingGame}, trpc, user } = $derived(_internal);
  let tooSmall = new MediaQuery("max-width: 768px");
  let isLoading = $state(true);

  // #region Games & GameVersions
  // svelte-ignore state_referenced_locally
  let selectedGameName = $state<string>(startingGame.game.name || ``);
  // svelte-ignore state_referenced_locally
  let selectedGame = $derived.by(() => games?.find((g) => g.name === selectedGameName));
  // svelte-ignore state_referenced_locally
  let gameVersions: GameVersionApiV3_full[] = $state((startingGame.gameVersions as GameVersionApiV3_full[]) || []);
  // svelte-ignore state_referenced_locally
  let selectedGameVersionId = $state<string>(query.gameVersionId || ``);
  let selectedGameVersion = $derived.by(() => gameVersions.find((v) => v.id === parseInt(selectedGameVersionId)));
  // #endregion

  let isFilterStatusVisible = $state(true);
  let isFilterCategoryVisible = $state(true);
  let filterMobileDrawerVisible = $state(false);
  let searchEngine = $state<ReturnType<typeof generateProjectSearchEngine>>();
  // svelte-ignore state_referenced_locally
  let searchQuery = $state(query.searchQuery || ``);
  // svelte-ignore state_referenced_locally
  let availableStatuses: Status[] = $derived.by(() => Array.from(new Set(Array.from(searchEngine?.mods.values() || []).map((result) => result.version.status))));
  // svelte-ignore state_referenced_locally
  let selectedStatuses = $state<Status[]>(query.statuses.length > 0 ? query.statuses : [Status.Verified]);
  let selectedCategories = $state<string[]>([]);
  let filteredMods = $derived.by(() => {
    if (!searchEngine) return [];
    //debugger;
    let searchResults = searchQuery.trim() !== "" ? searchEngine.search(searchQuery) : Array.from(searchEngine.mods.values());
    searchResults = searchResults.filter((result) => {
      if (selectedStatuses && selectedStatuses.length !== 0 && !selectedStatuses.includes(result.version.status)) return false;
      if (selectedCategories && selectedCategories.length !== 0 && !selectedCategories.some((category) => category == result.project.category)) return false;
      return true;
    });
    return searchResults.sort((a,b) => sortCategoriesPublic(a.project,b.project));
  });
  let totalSize = $derived(filteredMods.length);
  let currentPage = $state(1);
  let pageSize = $state(20);
  let filterModsPageView = $derived.by(() => {
    let startIndex = (currentPage - 1) * pageSize;
    let endIndex = startIndex + pageSize;
    return filteredMods.slice(startIndex, endIndex);
  });

  async function fetchMods() {
    if (!selectedGame) return;
    isLoading = true;
    let statusLookup = getAllowedVersionStatuses(user, false, selectedGame.name);
    if (gameVersions.some((v) => v.gameName !== selectedGame.name)) {
      await trpc.v3.games.getGameVersions.query({ gameName: selectedGame.name, includeExtras: true }).then((versions) => {
        gameVersions = versions.gameVersions as GameVersionApiV3_full[];
        selectedGameVersionId = gameVersions.find((v: any) => v.defaultVersion)?.id.toString() || ``;
      });
    }
    let mods = await trpc.v3.mods.getMods.query({
      gameName: selectedGame.name,
      gameVersion: selectedGameVersion ? selectedGameVersion.version : undefined,
      status: statusLookup
    });
    searchEngine = generateProjectSearchEngine(mods);
    isLoading = false;
    return mods;
  }

  onMount(async () => {
    isLoading = true;
    fetchMods();
  });

  $effect(() => {
    if (availableStatuses.length === 0) return;
    if (availableStatuses.length === 1 && availableStatuses.includes(Status.Verified)) {
      selectedStatuses = [Status.Verified];
      isFilterStatusVisible = false;
    } else {
      isFilterStatusVisible = true;
    }
  });

  $effect(() => {
    if (!selectedGame) return;
    let searchParams = new URLSearchParams();
    if (selectedGame) searchParams.set("game", selectedGame.name);
    if (selectedGameVersion) searchParams.set("gameVersion", selectedGameVersion.id.toString());
    if (selectedCategories.length > 0) searchParams.set("category", selectedCategories.join(","));
    if (searchQuery.trim() !== "") searchParams.set("search", searchQuery);
    if (selectedStatuses.length > 0 && selectedStatuses.every(s => s !== Status.Verified)) searchParams.set("status", selectedStatuses.join(","));
    untrack(() => tick().then(() =>replaceState(`${location.pathname}${searchParams.size > 0 ? `?${searchParams.toString()}` : ""}`, page.state)));
  });
</script>

{#snippet searchFilter()}
  <div class="flex flex-col bg-card gap-2 p-4 rounded-md">
    <div class="flex flex-row w-full gap-2">
      <Input bind:value={searchQuery} placeholder="Search..." />
      {#if tooSmall.current}
        <Button variant="outline" onclick={() => (filterMobileDrawerVisible = true)}>
          <FunnelIcon class="h-4 w-4" />
          <span class="sr-only">{m["search.showFilters"]()}</span>
        </Button>
      {/if}
    </div>
    <div class="flex flex-col justify-center items-center">
      <MiniPagination bind:totalCount={totalSize} bind:selectedPageSize={pageSize} bind:currentPage={currentPage} />
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
          <Select.Trigger class="w-full">{selectedGameVersion?.version || m[`common.all`]()}</Select.Trigger>
          <Select.Content>
            <Select.Item value={``}>{m[`common.all`]()}</Select.Item>
            {#each gameVersions as version}
              <Select.Item value={version.id.toString()}>{version.version}</Select.Item>
            {/each}
          </Select.Content>
        </Select.Root>
      </span>
    {/if}
    {#if selectedGameVersion?.isDeprecated}
      <div class="flex flex-col gap-2 bg-orange-800/20 px-4 py-2 rounded-md">
        <div class="flex flex-row items-center gap-2">
          <TriangleAlertIcon class="h-16 w-16 text-amber-500 mx-1" />
          <span class="text-base/tight text-amber-500">{m["mods.deprecatedVersionWarning"]()}</span>
        </div>
        <span class="text-xs text-orange-300">{m["mods.deprecatedVersionWarningDescription"]()}</span>
      </div>
    {/if}
  </div>
{/snippet}

{#snippet statusFilter()}
  <Collapsible.Root bind:open={isFilterStatusVisible}>
    <div class="flex flex-col bg-card rounded-md min-w-62 w-full py-2 px-4">
      <Collapsible.Trigger class="flex items-center justify-between w-full">
        <span class="text-lg font-semibold">{m["common.dataTable.status"]()}</span>
        <ChevronRightIcon class="h-4 w-4 transition-transform {isFilterStatusVisible ? `rotate-90` : ``}" />
      </Collapsible.Trigger>
      <Collapsible.Content class="my-2">
        {#each availableStatuses.sort((a,b) => b.localeCompare(a)) as status}
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
    <div class="flex flex-col bg-card rounded-md min-w-62 w-full py-2 px-4">
      <Collapsible.Trigger class="flex items-center justify-between w-full">
        <span class="text-lg font-semibold">{m["common.dataTable.category"]()}</span>
        <ChevronRightIcon class="h-4 w-4 transition-transform {isFilterCategoryVisible ? `rotate-90` : ``}" />
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

<div class="flex flex-row not-md:flex-col gap-4 m-auto max-w-[95%] mb-4">
  <!-- left filter/search bar -->
  {#if !tooSmall.current}
    <div class="flex flex-col w-64 gap-2">
      {@render gameFilter()}
      {@render searchFilter()}
      {@render categoryFilter()}
      {@render statusFilter()}
    </div>
  {:else}
    <div class="flex flex-col w-full max-w-84 m-auto gap-2">
      {@render gameFilter()}
      {@render searchFilter()}
    </div>
  {/if}
  <!-- right content area -->
  <div class="flex-1 gap-4 flex flex-row flex-wrap items-start justify-center-safe">
    {#if !isLoading}
      {#each filterModsPageView as mod}
        <ModCard project={mod.project} version={mod.version} gameDisplayName={selectedGame?.displayName} />
      {/each}
    {:else}
      {#each { length: pageSize }}
        <Skeleton class="w-84 h-64 rounded-md" />
      {/each}
    {/if}
  </div>
  {#if tooSmall.current}
    <div class="flex flex-col w-full gap-2">
      {@render searchFilter()}
    </div>
  {/if}
</div>

<Drawer.Root bind:open={filterMobileDrawerVisible}>
  <Drawer.Content>
    <div class="overflow-y-auto h-full pr-4">
      {@render categoryFilter()}
      {@render statusFilter()}
    </div>
  </Drawer.Content>
</Drawer.Root>