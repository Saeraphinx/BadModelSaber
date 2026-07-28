<script lang="ts">
  import type { GameVersionApiV3_full } from "../../scripts/from_backend/DBExtras";
  import * as Accordion from "$shadcn/components/ui/accordion/index.js";
  import Button from "../../shadcn/components/ui/button/button.svelte";

  let {
    gameVersions,
    selectedGameVersionIds = $bindable([]),
  } : {
    gameVersions: GameVersionApiV3_full[],
    selectedGameVersionIds: number[],
  } = $props();

  // all versions sorted into arrays for each group name, then  in that array its sorted by version number
  let sortedVersions = $derived.by(() => {
    let groups: Record<string, GameVersionApiV3_full[]> = {};
    for (let version of gameVersions) {
      let groupName = version.groupName ?? "Ungrouped";
      if (!groups[groupName]) {
        groups[groupName] = [];
      }
      groups[groupName].push(version);
    }
    for (let groupName in groups) {
      groups[groupName].sort((b, a) => a.version.localeCompare(b.version));
    }
    
    // sort the groups by group name, with "Ungrouped" at the end
    let sortedGroupNames = Object.keys(groups).sort((a, b) => {
      if (a === "Ungrouped") return 1;
      if (b === "Ungrouped") return -1;
      return a.localeCompare(b);
    });
    let sortedGroups: Record<string, GameVersionApiV3_full[]> = {};
    for (let groupName of sortedGroupNames) {
      sortedGroups[groupName] = groups[groupName];
    }

    return sortedGroups;
  }) ;

</script>

<div class="flex flex-col gap-2 max-h-72 overflow-y-auto">
  <Accordion.Root type="multiple" class="w-full">
    {#each Object.entries(sortedVersions) as [groupName, versions]}
      <Accordion.Item value={groupName} class="border rounded-md">
        <Accordion.Trigger class="w-full text-left px-4 py-2 font-semibold">{groupName}</Accordion.Trigger>
        <Accordion.Content class="px-4 py-2">
          <div class="flex flex-row flex-wrap gap-2">
            {#each versions as version}
              <Button
                size="sm"
                variant={selectedGameVersionIds?.find(sgv => sgv == version.id) ? "default" : "outline"}
                onclick={() => {
                  if (selectedGameVersionIds?.find(sgv => sgv == version.id)) {
                    selectedGameVersionIds = selectedGameVersionIds.filter(sgv => sgv != version.id) ?? null;
                  } else {
                    selectedGameVersionIds = [...(selectedGameVersionIds ?? []), version.id];
                  };
                }}
              >
                {version.version}
                {#if version.defaultVersion}
                  <span class="text-sm text-green-500">(Default)</span>
                {/if}
              </Button>
            {/each}
          </div>
        </Accordion.Content>
      </Accordion.Item>
    {/each}
  </Accordion.Root>
</div>