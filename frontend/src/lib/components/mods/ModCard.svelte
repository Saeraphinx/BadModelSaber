<script lang="ts">
  import { m } from "$lib/paraglide/messages";
  import type { ProjectApiV3, VersionApiV3 } from "$lib/scripts/api/DBTypes";
  import { getVersionDownloadUrl } from "$lib/scripts/utils/api";
  import Button from "$shadcn/components/ui/button/button.svelte";
  import type { HTMLAttributes } from "svelte/elements";
  import DownloadButton from "../generic/DownloadButton.svelte";
  import { cn } from "$shadcn/utils";
  import UserBadge from "../users/UserBadge.svelte";

  const {
    project,
    version,
    gameDisplayName,
    class: className,
    ...restProps
  }: {
    project: ProjectApiV3,
    version?: VersionApiV3,
    gameDisplayName?: string
  } & HTMLAttributes<HTMLDivElement> = $props();
</script>

<div class={cn("flex flex-col w-xs h-56 gap-2 bg-card rounded-lg p-4", className)} {...restProps}>
  <div class="flex flex-row gap-2 items-center">
    <img class="h-16 w-16" alt="icon for {project.name}" src={project.iconFileName} />
    <div class="flex flex-col gap-1">
      <span class="flex flex-row items-end gap-1">
        <a href="/mods/{project.id}" class="text-lg" aria-hidden="true">{project.name}</a>
        <p class="text-lg sr-only">{project.name}</p>
        <p class="text-xs text-muted-foreground pb-1">v{version?.semver}</p>
      </span>
      <span class="flex flex-row gap-1">
        {#each project.authors as author}
          <!-- <a href="/users/{author.id}" class="text-sm text-gray-500 hover:underline">{author.displayName}</a> -->
           <UserBadge small={true} user={author} />
        {/each}
      </span>
      {#if version}
        <span class="flex flex-row items-center gap-1">
          <p class="text-xs text-muted-foreground pb-1">{project.category} | {gameDisplayName} {version.supportedGameVersions[version.supportedGameVersions.length - 1].version}</p>
        </span>
      {/if}
    </div>
  </div>
  <div class="flex-1 flex flex-col justify-between">
    <p class="text-base">{project.summary}</p>
    <div class="grid grid-cols-2 gap-2 mt-2">
      <Button variant="secondary" href="/mods/{project.id}" class="">View Details</Button>
      {#if version}
        <DownloadButton variant="outline" downloadType="mod" href={getVersionDownloadUrl(version)} class="">{m["common.buttons.download"]()}</DownloadButton>
      {:else}
        <Button variant="outline" disabled class="">{m["common.buttons.download"]()}</Button>
      {/if}
    </div>
  </div>
</div>