<script lang="ts">
  import Markdown from '$lib/components/generic/Markdown.svelte';
  import VersionCard from '$lib/components/mods/VersionCard.svelte';
  import { m } from '$lib/paraglide/messages';
  import { getRelativeTimeString, getStatusString } from '$lib/scripts/utils/stylizer.js';
  import { Root } from '$shadcn/components/ui/accordion';
  import { Button } from '$shadcn/components/ui/button/index.js';
  import { Separator } from '$shadcn/components/ui/separator';
  import { Skeleton } from '$shadcn/components/ui/skeleton';
  import * as Tabs from '$shadcn/components/ui/tabs';
  import * as Tooltip from '$shadcn/components/ui/tooltip/index.js';
  

  const { data: _internal } = $props();
  const { pageData } = $derived(_internal);
</script>

<div class="flex flex-col gap-4 m-auto w-[90%] max-w-[95%]">
  <div class="flex flex-row flex-grow">
    <!-- <img src={pageData.project.iconFileName} alt="Project Thumbnail" class="w-32 h-32 object-cover rounded-lg mb-4" /> -->
    <Skeleton class="w-32 h-32 rounded-lg" />
    <div class="flex flex-col ml-4">
      <h1 class="text-3xl font-bold mb-1">{pageData.project.name}</h1>
      <p class="text-gray-600 mb-2">{pageData.project.summary}</p>
      <div class="flex items-center mb-2">
        <span class="text-sm text-gray-500 mr-2">Author: {pageData.project.authors.map(a => a.displayName).join(`, `)}</span>
        <span class="text-sm text-gray-500">Created: {new Date(pageData.project.createdAt).toLocaleDateString()}</span>
      </div>
    </div>
  </div>
  <Separator />
  <div class="flex flex-row gap-4">
    <div class="w-sm">
      {#if pageData.versions.length > 0}
        <div class="flex flex-col gap-2">
          {#each pageData.versions as version}
            <VersionCard version={version} />
          {/each}
        </div>
      {/if}
    </div>
    <div class="w-full">
      <!-- Databar -->
      <div class="flex justify-evenly bg-card rounded-md p-4 mb-4">
        <div class="flex flex-col items-center justify-center">
          <p class="text-sm text-gray-500">{m["mods.dataTable.status"]()}</p>
          <p class="text-base font-bold">{getStatusString(pageData.project.status)}</p>
        </div>
        <div class="flex flex-col items-center justify-center">
          <p class="text-sm text-gray-500">{m["mods.dataTable.game"]()}</p>
          <p class="text-base font-bold">{pageData.project.gameName}</p>
        </div>
        <div class="flex flex-col items-center justify-center">
          <p class="text-sm text-gray-500">{m["mods.dataTable.category"]()}</p>
          <p class="text-base font-bold">{pageData.project.category}</p>
        </div>
        <div class="flex flex-col items-center justify-center">
          <p class="text-sm text-gray-500">{m["mods.dataTable.createdAt"]()}</p>
          <Tooltip.Root>
            <Tooltip.Trigger class="text-base font-bold">
              {getRelativeTimeString(new Date(pageData.project.createdAt))}
            </Tooltip.Trigger>
            <Tooltip.Content class="bg-card text-card-foreground rounded-md p-2 text-sm">
              {new Date(pageData.project.createdAt).toLocaleString()}
            </Tooltip.Content>
          </Tooltip.Root>
        </div>
      </div>
      <Markdown class="mx-2" markdown={pageData.project.description} />
    </div>
  </div>
</div>