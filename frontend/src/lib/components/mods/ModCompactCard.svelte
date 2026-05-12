<script lang="ts">
  import { m } from "$lib/paraglide/messages";
  import type { ProjectApiV3, VersionApiV3 } from "$lib/scripts/api/DBTypes";
  import { getProjectThumbnailUrl, getVersionDownloadUrl } from "$lib/scripts/utils/api";
  import Button from "$shadcn/components/ui/button/button.svelte";
  import type { HTMLAttributes } from "svelte/elements";
  import DownloadButton from "../generic/DownloadButton.svelte";
  import { cn } from "$shadcn/utils";
  import UserBadge from "../users/UserBadge.svelte";
  import StatusHoverCard from "../generic/StatusHoverCard.svelte";
  import { BadgeAlertIcon, Code2Icon, DownloadIcon, FileBracesCornerIcon, FolderKanbanIcon, InfoIcon } from "@lucide/svelte";

  const {
    project,
    version,
    class: className,
    showFileDialog,
    showCodeDialog,
    showManifestDialog,
    showApprovalDialog,
    showNonAuthorWarning = false,
    ...restProps
  }: {
    project: ProjectApiV3,
    version: VersionApiV3,
    showFileDialog?: () => void
    showCodeDialog?: () => void
    showManifestDialog?: () => void
    showApprovalDialog?: () => void
    showNonAuthorWarning?: boolean
  } & HTMLAttributes<HTMLDivElement> = $props();
</script>

<div class={cn("flex flex-col w-84 min-h-36 gap-2 bg-card rounded-md p-4", className)} {...restProps}>
  <div class="flex flex-row gap-2 items-center">
    <div class="flex flex-col gap-1 items-center">
      <img class="h-16 w-16 rounded-md" alt="icon for {project.name}" src={getProjectThumbnailUrl(project)} />
      <StatusHoverCard status={version?.status || project.status} type="mod" />
    </div>
    <div class="flex flex-col">
      <span class="flex flex-row items-end gap-1 ">
        <a href="/mods/{project.id}" class="text-lg/tight flex flex-row flex-wrap items-end gap-1 max-w-56 overflow-hidden text-ellipsis whitespace-nowrap" title={project.name} aria-hidden="true">
          {project.name}
          {#if version}
            <p class="text-xs/normal text-muted-foreground">v{version.semver}</p>
          {/if}
        </a>
      </span>
      <span class="flex flex-row gap-1">
        {#each project.authors as author}
          <a href="/users/{author.id}" class="text-xs text-gray-500 hover:underline">{author.displayName}</a>
          <!-- <UserBadge small={true} user={author} /> -->
        {/each}
        <p class="text-xs text-muted-foreground"> | {project.category}</p>
      </span>
      {#if showNonAuthorWarning && project.authors.every(a => a.id !== version.uploaderId)}
        <span class="flex flex-row items-center gap-1">
          <p class="text-xs text-muted-foreground">[Non-Author] Uploaded by ID: </p>
          <a href="/users/{version.uploaderId}" class="text-xs text-gray-500 hover:underline">{version.uploaderId}</a>
        </span>
      {/if}
      <p class="text-sm line-clamp-3 mt-1">{project.summary}</p>
    </div>
  </div>
  <div class="flex-1 flex flex-col justify-between">
    <div class="flex flex-row justify-end items-end gap-2">
      {#if showFileDialog}
        <Button variant="secondary" size="icon" onclick={showFileDialog} class=""><FolderKanbanIcon /></Button>
      {/if}
      {#if showManifestDialog}
        <Button variant="secondary" size="icon" onclick={showManifestDialog} class=""><FileBracesCornerIcon /></Button>
      {/if}
      {#if showCodeDialog}
        <Button variant="secondary" size="icon" onclick={showCodeDialog} class=""><Code2Icon /></Button>
      {/if}
      <Button variant="secondary" size="icon" href="/mods/{project.id}" class=""><InfoIcon /></Button>
      {#if showApprovalDialog}
        <Button variant="destructive" size="icon" onclick={showApprovalDialog} class=""><BadgeAlertIcon /></Button>
      {/if}
      <DownloadButton variant="default" size="icon" downloadType="mod" status={version.status} href={getVersionDownloadUrl(version)} class=""><DownloadIcon /></DownloadButton>
    </div>
  </div>
</div>