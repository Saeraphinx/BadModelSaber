<script lang="ts">
  import { Status, type GameVersionApiV3, type VersionApiV3 } from "$lib/scripts/api/DBTypes";
  import { getRelativeTimeString } from "$lib/scripts/utils/stylizer";
  import * as Accordion from "$shadcn/components/ui/accordion/index";
  import { BadgeInfoIcon, FileCodeIcon, FolderIcon, InfoIcon, ServerCogIcon, ShieldPlusIcon } from "@lucide/svelte";
  import ApprovalDialog from "../dialogs/ApprovalDialog.svelte";
  import CodeDialog from "../dialogs/CodeDialog.svelte";
  import StatusHoverCard from "../generic/StatusHoverCard.svelte";
  import { getVersionDecompUrl, getVersionDownloadUrl, getVersionManifestUrl, parseErrorMessage, trpc } from "$lib/scripts/utils/api";
  import Spinner from "$shadcn/components/ui/spinner/spinner.svelte";
  import Button from "$shadcn/components/ui/button/button.svelte";
  import { m } from "$lib/paraglide/messages";
  import DownloadButton from "../generic/DownloadButton.svelte";
  import * as Select from "$shadcn/components/ui/select";
  import { toast } from "svelte-sonner";
  import { gvCompareDecending } from "../../scripts/api/sortGV";

  const {
    version,
    showStatusHistory,
    approvalDialog,
    codeDialog,
    isEditable = false,
    gameVersions = $bindable([]),
  }: {
    version: VersionApiV3;
    showStatusHistory?: boolean;
    approvalDialog?: ApprovalDialog;
    codeDialog?: CodeDialog;
    isEditable?: boolean;
    gameVersions?: GameVersionApiV3[];
  } = $props();


  let depProjects: Awaited<ReturnType<typeof getDependencyProjects>> = $state([])
  async function getDependencyProjects() {
    return await trpc.internal.mods.getBulkProjects.query({ projectIds: version.dependencies.map(d => d.pId) }).then(projects => {
      depProjects = projects;
      return projects;
    });
  }

  async function showCode(type: "code" | "manifest") {
    let data = `No data available.`;
    if (codeDialog) {
      if (type === "code")
        data = await fetch(getVersionDecompUrl(version)).then(res => res.ok ? res.text() : `Failed to fetch code: ${res.statusText}`);
      else if (type === "manifest")
        data = await fetch(getVersionManifestUrl(version)).then(res => res.ok ? res.text() : `Failed to fetch manifest: ${res.statusText}`);
      if (data === "null" || data.trim() === "") data = `No data available.`;
      codeDialog.showDialog(data, type === "code" ? `cs` : `json`, Boolean(approvalDialog),  type === "code" ? getVersionDecompUrl(version) : getVersionManifestUrl(version));
    }
  }

  let isEditing = $state(false);
  // svelte-ignore state_referenced_locally
  let editedGameVersionIds = $state(version.supportedGameVersions.map(gv => gv.id.toString()));
  // svelte-ignore state_referenced_locally
  let editedDependencies = $state(version.dependencies);

  function saveChanges() {
    trpc.internal.updateThings.updateVersion.mutate({
      versionId: version.id,
      data: {
        supportedGameVersionIds: editedGameVersionIds.map(id => parseInt(id)),
      }
    }).then(() => {
      toast.success(m["toasts.versionUpdateSuccess"]());
      isEditing = false;
      version.supportedGameVersions = gameVersions.filter(gv => editedGameVersionIds.includes(gv.id.toString()));
    }).catch(err => {
      // handle error, maybe show a toast or something
      console.error(err);
      toast.error(`Failed to update version`, {
        description: parseErrorMessage(err),
      });
    });
  }
  
</script>

<div class="p-2 border rounded-lg bg-card" data-sveltekit-preload-data="false" data-sveltekit-preload-code="false">
  <div class="flex items-start justify-between mb-2 px-2">
    <p class="text-lg font-medium">{version.semver}</p>
    <span class="flex flex-row items-center gap-1">
      <p title={new Date(version.createdAt).toISOString()} class="text-sm text-gray-500">{getRelativeTimeString(new Date(version.createdAt))}</p>
      <StatusHoverCard status={version.status} type="mod" />
    </span>
  </div>
  <div class="flex flex-col items-center">
    <Accordion.Root type="multiple" value={["supportedGameVersions"]} class="w-full">
      <Accordion.Item value="supportedGameVersions" class="px-2 py-1">
        <Accordion.Trigger class="text-sm font-normal p-0.5">
          <span class="flex flex-row items-center gap-1">
            <ServerCogIcon class="h-4 w-4" />
            {m["mods.dataTable.supportedGameVersions"]()}
          </span>
        </Accordion.Trigger>
        <Accordion.Content class="p-2">
          {#if isEditing}
           <div>
            <Select.Root type="multiple" bind:value={editedGameVersionIds}>
              <Select.Trigger class="w-full">
                {editedGameVersionIds.length} selected
              </Select.Trigger>
              <Select.Content class="w-full">
                {#each gameVersions as gv}
                  <Select.Item value={gv.id.toString()}>{gv.version}</Select.Item>
                {/each}
              </Select.Content>
            </Select.Root>
           </div>
         {:else}
          <div class="flex flex-row flex-wrap gap-1">
            {#each version.supportedGameVersions.sort(gvCompareDecending) as gv}
              <span class="text-sm bg-accent p-0.5 px-1 rounded-md">{gv.version}</span>
            {/each}
          </div>
        {/if}
        </Accordion.Content>
      </Accordion.Item>
      <Accordion.Item value="dependencies" class="px-2 py-1">
        <Accordion.Trigger class="text-sm font-normal p-0.5">
          <span class="flex flex-row items-center gap-1">
            <FolderIcon class="h-4 w-4" />
            {m["mods.dataTable.dependencies"]()}
          </span>
        </Accordion.Trigger>
        <Accordion.Content class="p-2">
          <div class="flex flex-row flex-wrap gap-1">
            {#if version.dependencies.length > 0}
              {#await getDependencyProjects()}
                <div class="flex flex-row items-center justify-center p-2 gap-2">
                  <Spinner class="h-6 w-6" />
                  <p class="text-sm text-gray-500 ml-2">Loading dependencies...</p>
                </div>
              {:then projects} 
                {#each version.dependencies.sort((a,b) => a.pId - b.pId) as dep}
                  {#if projects.find(p => p.id === dep.pId)}
                    <a href={`/mods/${dep.pId}`} class="text-sm bg-accent p-0.5 px-1 rounded-md">{projects.find(p => p.id === dep.pId)?.name} <span class="text-xs text-muted-foreground">{dep.sv}</span></a>
                  {:else}
                    <p class="text-sm bg-accent">ID #{dep.pId} {dep.sv}</p>
                  {/if}
                {/each}
              {/await}
            {:else}
              <p class="text-sm text-gray-500">{m[`mods.dataTable.noDependencies`]()}</p>
            {/if}
          </div>
        </Accordion.Content>
      </Accordion.Item>
      {#if codeDialog}
        <Accordion.Item value="openDialogs" class="px-2 py-1">
          <Accordion.Trigger class="text-sm font-normal p-0.5">
            <span class="flex flex-row items-center gap-1">
              <FileCodeIcon class="h-4 w-4" />
              {m["mods.dataTable.filesAndManifest"]()}
            </span>
          </Accordion.Trigger>
          <Accordion.Content class="p-2">
            <div class="flex flex-row flex-wrap gap-2 justify-center">
              <Button variant="outline" size="sm" onclick={() => showCode("code")}>
                {m[`mods.dataTable.viewCode`]()}
              </Button>
              <Button variant="outline" size="sm" onclick={() => showCode("manifest")}>
                {m[`mods.dataTable.viewManifest`]()}
              </Button>
            </div>
          </Accordion.Content>
        </Accordion.Item>
      {/if}
      {#if showStatusHistory || approvalDialog}
        <Accordion.Item value="approval" class="px-2 py-1">
          <Accordion.Trigger class="text-sm font-normal p-0.5">
            <span class="flex flex-row items-center gap-1">
              <BadgeInfoIcon class="h-4 w-4" />
              {m[`mods.dataTable.approvalHistory`]()}
            </span>
          </Accordion.Trigger>
          <Accordion.Content class="p-2">
            {#if showStatusHistory}
              <div class="flex flex-col gap-2">
                {#each version.statusHistory as sh}
                  <div class="flex flex-row items-center gap-2">
                    <p>{sh.status} by {sh.userId} at {new Date(sh.timestamp).toISOString()}<br>Reason: {sh.reason}</p>
                  </div>
                {/each}
              </div>
            {/if}
            {#if approvalDialog}
              <Button variant="outline" size="sm" onclick={() => approvalDialog?.showDialog(version.id, version.semver, `version`)}>
                {m["common.buttons.approvalDialog"]()}
              </Button>
            {/if}
          </Accordion.Content>
        </Accordion.Item>
      {/if}
      <Accordion.Item value="details" class="px-2 py-1">
        <Accordion.Trigger class="text-sm font-normal p-0.5">
          <span class="flex flex-row items-center gap-1">
            <InfoIcon class="h-4 w-4" />
            {m[`mods.dataTable.details`]()}
          </span>
        </Accordion.Trigger>
        <Accordion.Content class="p-2">
          <div class="flex flex-col gap-1">
            tbd
          </div>
        </Accordion.Content>
      </Accordion.Item>
    </Accordion.Root>
    <div class="flex flex-row justify-end gap-2 w-full">
      {#if isEditable}
        {#if isEditing}
          <Button variant="outline" size="sm" onclick={() => isEditing = !isEditing}>
            {m[`dialogs.cancel`]()}
          </Button>
           <Button variant="outline" size="sm" onclick={saveChanges}>
            {m[`dialogs.save`]()}
           </Button>
        {:else}
          <Button variant="outline" size="sm" onclick={() => isEditing = !isEditing}>
            {m[`dialogs.edit`]()}
          </Button>
        {/if}
      {/if}
      <DownloadButton variant="outline" size="sm" downloadType="mod" status={version.status} href={getVersionDownloadUrl(version)}>
        {m[`common.buttons.download`]()} ({version.fileSize > 0 ? (version.fileSize / (1024 * 1024)).toFixed(2) + " MB" : "N/A"})
      </DownloadButton>
    </div>
  </div>
</div>
