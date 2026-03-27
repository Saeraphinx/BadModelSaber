<script lang="ts">
  import type { ProjectApiV3, VersionApiV3 } from "$lib/scripts/api/DBTypes";
  import Button from "$shadcn/components/ui/button/button.svelte";

  const {
    project,
    version
  }: {
    project: ProjectApiV3,
    version?: VersionApiV3
  } = $props();
</script>

<div class="flex flex-col w-sm h-48 gap-2 bg-card rounded-lg p-4">
  <div class="flex flex-row gap-2">
    <img class="h-16 w-16"  src={project.iconFileName} />
    <div class="flex flex-col">
      <span class="flex flex-row items-end gap-1">
        <p class="text-lg">{project.name}</p>
        <p class="text-xs text-muted-foreground pb-1">v{version?.semver}</p>
      </span>
      <p>Author</p>
    </div>
  </div>
  <div class="flex-1 flex flex-col justify-between">
    <p>{project.summary}</p>
    <div class="grid grid-cols-2 gap-2">
      <Button variant="secondary" class="">View Details</Button>
      <Button variant="outline" class="">Download</Button>
    </div>
  </div>
</div>