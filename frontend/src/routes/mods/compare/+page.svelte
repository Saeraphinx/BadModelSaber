<script lang="ts">
  import { i18n } from "$lib/scripts/i18n";

  const { t } = i18n();
  import type { GameVersionApiV3, ProjectApiV3, VersionApiV3 } from "$lib/scripts/from_backend/DBExtras";
  import { Label } from "$lib/shadcn/components/ui/label";
  import * as Select from "$lib/shadcn/components/ui/select";
  import { onMount } from "svelte";
  import Button from "../../../lib/shadcn/components/ui/button/button.svelte";
  import { toast } from "svelte-sonner";
  import { parseErrorMessage } from "../../../lib/scripts/utils/api";

  const { data: _internal } = $props();
  const { pageData, trpc, user } = $derived(_internal);

  let isLoading = $state(true);
  const games = $derived(pageData.games);
  // svelte-ignore state_referenced_locally
  let selectedGameName = $state<string>(pageData.defaultGame.game.name || ``);
  // svelte-ignore state_referenced_locally
  let selectedGame = $derived.by(() => games?.find((g) => g.name === selectedGameName));
  // svelte-ignore state_referenced_locally
  let gameVersions: GameVersionApiV3[] = $state(pageData.defaultGame.gameVersions || []);
  // svelte-ignore state_referenced_locally
  let selectedGameVersionId1 = $state<string>(pageData.defaultGame.gameVersions.find((v: any) => v.defaultVersion)?.id.toString() || ``);
  let selectedGameVersion1 = $derived.by(() => gameVersions.find((v) => v.id === parseInt(selectedGameVersionId1)));
  // svelte-ignore state_referenced_locally
  let selectedGameVersionId2 = $state<string>(pageData.defaultGame.gameVersions[0].id.toString() || ``);
  let selectedGameVersion2 = $derived.by(() => gameVersions.find((v) => v.id === parseInt(selectedGameVersionId2)));

  let modList1: { project: ProjectApiV3; version: VersionApiV3 }[] = $state([]);
  let modList2: { project: ProjectApiV3; version: VersionApiV3 }[] = $state([]);

  function fetchGameVersions() {
    if (!selectedGame) return;
    let previousSelectedGame = selectedGame;
    trpc.v3.games.getGameVersions.query({ gameName: selectedGame.name }).then((res) => {
      gameVersions = res.gameVersions;
      if (!gameVersions.find((v) => v.id.toString() === selectedGameVersionId1)) {
        selectedGameVersionId1 = gameVersions[0]?.id.toString() || ``;
      }
      if (!gameVersions.find((v) => v.id.toString() === selectedGameVersionId2)) {
        selectedGameVersionId2 = gameVersions[0]?.id.toString() || ``;
      }
      fetchCompatibleMods();
    }).catch((err) => {
      selectedGame = previousSelectedGame;
      toast.error(`Error fetching game versions: ${parseErrorMessage(err)}`);
    });
  }

  function fetchCompatibleMods() {
    let p1, p2;
    if (selectedGameVersion1) {
      p1 = trpc.v3.mods.getMods.query({ gameName: selectedGameName, gameVersion: selectedGameVersion1.version }).then((res) => {
        modList1 = res;
      });
    }
    if (selectedGameVersion2) {
      p2 = trpc.v3.mods.getMods.query({ gameName: selectedGameName, gameVersion: selectedGameVersion2.version }).then((res) => {
        modList2 = res;
      });
    }
    Promise.all([p1, p2]);
  }

  let compareArray = $derived.by(() => {
    const allProjectIds = [...new Set([...modList1.map((m) => m.project.id), ...modList2.map((m) => m.project.id)])];
    let processedData = allProjectIds.sort().map((projectId) => {
      let version1 = modList1.find((m) => m.project.id === projectId)?.version.semver || null;
      let version2 = modList2.find((m) => m.project.id === projectId)?.version.semver || null;
      return {
        projectId,
        category: modList1.find((m) => m.project.id === projectId)?.project.category || modList2.find((m) => m.project.id === projectId)?.project.category || `Unknown`,
        projectName: modList1.find((m) => m.project.id === projectId)?.project.name || modList2.find((m) => m.project.id === projectId)?.project.name || `Unknown`,
        version1: version1,
        version2: version2,
        v1Verified: modList1.find((m) => m.project.id === projectId)?.version.status === `verified` || version1 === null,
        v2Verified: modList2.find((m) => m.project.id === projectId)?.version.status === `verified` || version2 === null,
        isPresentIn1ButNot2: version1 !== null && version2 === null,
        isPresentIn2ButNot1: version2 !== null && version1 === null,
        isUpdatedIn2: version1 !== null && version2 !== null && version1 !== version2,
      };
    })

    let output: typeof processedData[] = [];
    processedData.forEach((data) => {
      let category = data.category || `Unknown`;
      let categoryIndex = output.findIndex((d) => d[0]?.category === category);
      if (categoryIndex === -1) {
        output.push([data]);
      } else {
        output[categoryIndex].push(data);
      }
    })
    output.sort((a, b) => {
      // put core, essential, library, leaderboard in that order, then the rest alphabetically
      const order = [`Mod Loader`, `Core`, `Essential`, `Library`, `Leaderboard`];
      let aIndex = order.indexOf(a[0].category);
      let bIndex = order.indexOf(b[0].category);
      if (aIndex === -1) aIndex = Number.POSITIVE_INFINITY;
      if (bIndex === -1) bIndex = Number.POSITIVE_INFINITY;
      if (aIndex !== bIndex) {
        return aIndex - bIndex;
      } else {
        return a[0].category.localeCompare(b[0].category);
      }
    });

    return output;
  });

  onMount(() => {
    fetchCompatibleMods();
  });
</script>

<div class="flex flex-col items-center gap-4">
  <div class="flex flex-row gap-2 bg-card rounded-lg p-4">
    <div class="grid grid-cols-3 not-sm:grid-rows-3 not-sm:grid-cols-1 not-sm:w-64 w-sm gap-2">
      <div class="flex flex-col gap-2">
        <Label class="ml-1">{t(`mods.game`)}</Label>
        <Select.Root type="single" bind:value={selectedGameName} onValueChange={fetchGameVersions}>
          <Select.Trigger class="w-full">{selectedGame?.displayName}</Select.Trigger>
          <Select.Content>
            {#each games as game}
              <Select.Item value={game.name}>{game.displayName}</Select.Item>
            {/each}
          </Select.Content>
        </Select.Root>
      </div>
      <div class="flex flex-col gap-2">
        <Label for="gameVersion1"  class="ml-1">Game Version 1</Label>
        <Select.Root bind:value={selectedGameVersionId1} type="single" onValueChange={fetchCompatibleMods}>
          <Select.Trigger id="gameVersion1" class="w-full sm:w-auto">
            {selectedGameVersion1?.version}
          </Select.Trigger>
          <Select.Content>
            {#each gameVersions as version}
              <Select.Item value={version.id.toString()}>{version.version}</Select.Item>
            {/each}
          </Select.Content>
        </Select.Root>
      </div>
      <div class="flex flex-col gap-2">
        <Label for="gameVersion2" class="ml-1">Game Version 2</Label>
        <Select.Root bind:value={selectedGameVersionId2} type="single" onValueChange={fetchCompatibleMods}>
          <Select.Trigger id="gameVersion2" class="w-full sm:w-auto">
            {selectedGameVersion2?.version}
          </Select.Trigger>
          <Select.Content>
            {#each gameVersions as version}
              <Select.Item value={version.id.toString()}>{version.version}</Select.Item>
            {/each}
          </Select.Content>
        </Select.Root>
      </div>
    </div>
    
  </div>
  {#if modList1.length !== 0 && modList2.length !== 0}
    <div>
      <table class="table-auto max-w-4xl w-[80%] md:table-fixed m-auto not-md:w-full">
        <thead>
          <tr>
            <th class="">Mod Name</th>
            <th class="">Available for {selectedGameVersion1?.version}</th>
            <th class="">Available for {selectedGameVersion2?.version}</th>
          </tr>

        </thead>
        <tbody>
          {#each compareArray as categoryArray}
              <tr>
                <td colspan="3" class="text-left font-bold text-lg bg-gray-700/50">{categoryArray[0].category}</td>
              </tr>
            {#each categoryArray as { projectId, projectName, version1, version2, v1Verified, v2Verified, isPresentIn1ButNot2, isPresentIn2ButNot1, isUpdatedIn2 }}
              <tr>
                <td class="wrap-anywhere hover:underline"><a href="/mods/{projectId}">{projectName}</a></td>
                <td class="wrap-anywhere {isPresentIn1ButNot2 ? `bg-red-400/60` : ``}">{version1 ?? `No`}{v1Verified ? `` : `[U]`}</td>
                <td class="wrap-anywhere {isPresentIn2ButNot1 ? `bg-green-400/40` : ``} {isUpdatedIn2 ? `bg-purple-400/20` : ``}">{version2 ?? `No`}{v2Verified ? `` : `[U]`}</td>
              </tr>
            {/each}
          {/each}
        </tbody>
      </table>
    </div>
  {/if}
</div>

<style>
  tr,
  td,
  th {
    padding: 0.05rem;
    text-align: center;
  }

  thead, th {
    font-weight: bold;
    padding: 0.5rem;
  }

  th {
    background-color: #2c2c2c80;
  }
  th:first-child {
    border-top-left-radius: 0.5rem;
  }
  th:last-child {
    border-top-right-radius: 0.5rem;
  }
</style>
