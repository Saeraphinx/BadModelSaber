<script lang="ts">
  import { Status, type GameVersionApiV3, type VersionApiV3 } from "$lib/scripts/from_backend/DBExtras";
  import { getRelativeTimeString } from "$lib/scripts/utils/stylizer";
  import * as Accordion from "$shadcn/components/ui/accordion/index";
  import { BadgeInfoIcon, DownloadIcon, FileCodeIcon, FolderIcon, InfoIcon, Link2Icon, LinkIcon, MegaphoneIcon, ServerCogIcon, SquarePenIcon, XIcon } from "@lucide/svelte";
  import ApprovalDialog from "../dialogs/ApprovalDialog.svelte";
  import CodeDialog from "../dialogs/CodeDialog.svelte";
  import ReportDialog from "../dialogs/ReportDialog.svelte";
  import StatusHoverCard from "../generic/StatusHoverCard.svelte";
  import { getVersionDecompUrl, getVersionDownloadUrl, getVersionManifestUrl, handleTrpcErrorWithToast, handleTrpcSuccessWithToast, parseErrorMessage, trpc } from "$lib/scripts/utils/api";
  import Spinner from "$shadcn/components/ui/spinner/spinner.svelte";
  import Button from "$shadcn/components/ui/button/button.svelte";
  import DownloadButton from "../generic/DownloadButton.svelte";
  import * as Select from "$shadcn/components/ui/select";
  import { toast } from "svelte-sonner";
  import { gvCompareDecending } from "../../scripts/from_backend/sortGV";
  import { onMount, tick } from "svelte";
  import { Separator } from "../../shadcn/components/ui/separator";
  import { m } from "../../paraglide/messages";

  const {
    version,
    showUserQueueOptions = false,
    showStatusHistory,
    approvalDialog,
    reportDialog,
    codeDialog,
    isEditable = false,
    gameVersions = $bindable([]),
    id = version.id.toString()
  }: {
    version: VersionApiV3;
    showUserQueueOptions?: boolean;
    showStatusHistory?: boolean;
    approvalDialog?: ApprovalDialog;
    codeDialog?: CodeDialog;
    reportDialog?: ReportDialog;
    isEditable?: boolean;
    gameVersions?: GameVersionApiV3[];
    id?: string;
  } = $props();


  let depProjects: Awaited<ReturnType<typeof getDependencyProjects>> = $state([])
  async function getDependencyProjects() {
    return await trpc.internal.getThings.getBulkProjects.query({ projectIds: version.dependencies.map(d => d.pId) }).then(projects => {
      depProjects = projects;
      return projects;
    });
  }

  async function showCode(type: "code" | "manifest" | "files") {
    let data = `No data available.`;
    if (codeDialog) {
      if (type === "code")
        data = await fetch(getVersionDecompUrl(version)).then(res => res.ok ? res.text() : `Failed to fetch code: ${res.statusText}`);
      else if (type === "manifest")
        data = await fetch(getVersionManifestUrl(version)).then(res => res.ok ? res.text() : `Failed to fetch manifest: ${res.statusText}`);
      else if (type === "files")
        data = JSON.stringify(version.contentHashes);
      if (data === "null" || data.trim() === "") data = `No data available.`;
      codeDialog.showDialog(data, type === "code" ? `cs` : `json`, Boolean(approvalDialog),  type === "code" ? getVersionDecompUrl(version) : getVersionManifestUrl(version), approvalDialog && type === "code" ? version.id : undefined);
    }
  }

  let isEditing = $state(false);
  // svelte-ignore state_referenced_locally
  let editedGameVersionIds = $state(version.supportedGameVersions.map(gv => gv.id.toString()));
  // svelte-ignore state_referenced_locally
  let editedDependencies = $state(version.dependencies);

  function saveChanges() {
    trpc.internal.updateThings.version.updateVersion.mutate({
      id: version.id,
      data: {
        supportedGameVersionIds: editedGameVersionIds.map(id => parseInt(id)),
      }
    }).then(handleTrpcSuccessWithToast(m[`toasts.success.savedChanges`](), false, () => {
      isEditing = false;
      version.supportedGameVersions = gameVersions.filter(gv => editedGameVersionIds.includes(gv.id.toString()));
    })).catch(handleTrpcErrorWithToast(m[`toasts.save.error`]()));
  }

  // #region Approval Actions
  function submitForApproval() {
    trpc.internal.updateThings.version.submitForApproval.mutate({
      id: version.id
    })
    .then(handleTrpcSuccessWithToast(m[`toasts.submit.success`]()))
    .catch(handleTrpcErrorWithToast(m[`toasts.submit.error`]()));
  }

  function removeFromQueue() {
    trpc.internal.updateThings.version.removeFromQueue.mutate({
      id: version.id
    }).then(handleTrpcSuccessWithToast(m[`toasts.save.success`]()))
    .catch(handleTrpcErrorWithToast(m[`toasts.save.error`]()));
  }
  // #endregion Approval Actions

  let highlighted = $state(false);
  onMount(async () => {
    await tick();
    if (id) {
      if (window.location.hash === `#${id}`) {
        let e = document.getElementById(document.location.hash.slice(1));
        if (e) {
          highlighted = true;
          e.scrollIntoView({ behavior: "smooth", block: "start" });
        }
      }
    }
  });
  
</script>

<div id="{id}" class="p-2 border rounded-md bg-card {highlighted ? `border-2 border-blue-500` : ``}" data-sveltekit-preload-data="false" data-sveltekit-preload-code="false" >
  <div class="flex items-center justify-between mb-2 px-2">
    <a class="text-lg font-medium pt-0.5" href="/mods/{version.projectId}#{version.id}">{version.semver}</a>
    <span class="flex flex-row items-center gap-1">
      <!-- <Button variant="ghost" size="sm" href="/mods/{version.projectId}#{version.id}" class="has-[>svg]:px-1 h-6"><Link2Icon class="text-gray-400"/></Button> -->
      <p title={new Date(version.createdAt).toISOString()} class="text-sm text-gray-500">{getRelativeTimeString(new Date(version.createdAt))}</p>
      <StatusHoverCard status={version.status} type="mod" countdownDate={version.nextStatusChangeTime} />
      {#if isEditable && version.status === Status.Queue}
        <Button variant="outline" size="sm" class="has-[>svg]:px-0 mt-0.5 h-6 w-6" onclick={() => removeFromQueue()}>
          <XIcon class="h-3.5 w-3.5" />
        </Button>
      {/if}
    </span>
  </div>
  <div class="flex flex-col items-center">
    <Accordion.Root type="multiple" value={["supportedGameVersions"]} class="w-full">
      <Accordion.Item value="supportedGameVersions" class="px-2 py-1">
        <Accordion.Trigger class="text-sm font-normal p-0.5">
          <span class="flex flex-row items-center gap-1">
            <ServerCogIcon class="h-4 w-4" />
            {m[`common.dataTable.supportedGameVersions`]()}
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
            {m[`common.dataTable.dependencies`]()}
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
              <p class="text-sm text-gray-500">{m[`common.dataTable.noDependencies`]()}</p>
            {/if}
          </div>
        </Accordion.Content>
      </Accordion.Item>
      {#if codeDialog}
        <Accordion.Item value="openDialogs" class="px-2 py-1">
          <Accordion.Trigger class="text-sm font-normal p-0.5">
            <span class="flex flex-row items-center gap-1">
              <FileCodeIcon class="h-4 w-4" />
              {m[`common.dataTable.filesAndManifest`]()}
            </span>
          </Accordion.Trigger>
          <Accordion.Content class="p-2">
            <div class="flex flex-row flex-wrap gap-2 justify-center">
              <Button variant="outline" size="sm" onclick={() => showCode("code")}>
                {m[`common.dataTable.viewCode`]()}
              </Button>
              <Button variant="outline" size="sm" onclick={() => showCode("manifest")}>
                {m[`common.dataTable.viewManifest`]()}
              </Button>
              <Button variant="outline" size="sm" onclick={() => showCode("files")}>
                {m[`common.dataTable.viewFiles`]()}
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
              {m[`common.dataTable.approvalHistory`]()}
            </span>
          </Accordion.Trigger>
          <Accordion.Content class="flex flex-col justify-center p-2">
            {#if showStatusHistory}
              <div class="flex flex-col gap-2">
                {#each version.statusHistory as sh}
                  <div class="flex flex-row items-center gap-2 border-2 p-2 rounded-md">
                    <p><span class="capitalize">{sh.status}</span> - {sh.userId} - {new Date(sh.timestamp).toLocaleString()}<br>Reason: {sh.reason}</p>
                  </div>
                {:else}
                  <p class="text-sm text-gray-500 text-center">No status history available.</p>
                {/each}
              </div>
            {/if}
            {#if approvalDialog}
              <Separator class="my-2" />
              <Button variant="outline" size="sm" onclick={() => approvalDialog?.showDialog(version.id, version.semver, `version`, version.status)}>
                {m[`common.buttons.approvalDialog`]()}
              </Button>
            {/if}
            {#if showUserQueueOptions}
              {#if version.status === Status.Queue || version.status === Status.Testing}
                <Separator class="my-2" />
                <Button variant="outline" size="sm" onclick={() => removeFromQueue()}>
                  {m[`common.buttons.removeFromQueue`]()}
                </Button>
              {:else if version.status === Status.Private}
                <Separator class="my-2" />
                <Button variant="outline" size="sm" onclick={() => submitForApproval()}>
                  {m[`common.buttons.submitForApproval`]()}
                </Button>
              {/if}
            {/if}
          </Accordion.Content>
        </Accordion.Item>
      {/if}
      <Accordion.Item value="details" class="px-2 py-1 border-0">
        <Accordion.Trigger class="text-sm font-normal p-0.5">
          <span class="flex flex-row items-center gap-1">
            <InfoIcon class="h-4 w-4" />
            {m[`common.dataTable.details`]()}
          </span>
        </Accordion.Trigger>
        <Accordion.Content class="p-2">
          <div class="flex flex-row flex-wrap gap-1">
            {#each [
              {title: m[`common.dataTable.id`]()  , content: `${version.id}`},
              {title: m[`common.dataTable.fileSize`](), content: `${version.fileSize > (1024 * 1024) ? `${(version.fileSize / (1024 * 1024)).toFixed(2)} MB` : `${(version.fileSize / 1024).toFixed(2)} KB`}`},
              {title: m[`common.dataTable.fileCount`](), content: `${version.contentHashes.length}`},
              {title: m[`common.dataTable.uploadedBy`](), content: `${version.uploaderId}`},
              {title: m[`common.dataTable.platform`](), content: `${version.platform}`},
              {title: m[`common.dataTable.lastUpdated`](), content: `${new Date(version.updatedAt).toLocaleDateString()}`, tooltip: `${new Date(version.updatedAt).toLocaleString()}`}
              ] as item}
              <div class="flex flex-row text-sm bg-accent p-0.5 px-1 gap-0.5 rounded-md">
                <p class="text-sm text-muted-foreground">{item.title}:</p>
                <p class="text-sm text-foreground" title={item.tooltip ? item.tooltip : undefined}>{item.content}</p>
              </div>
            {/each}
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
            <SquarePenIcon class="h-4 w-4" />
            {m[`dialogs.edit`]()}
          </Button>
        {/if}
      {/if}
      {#if !isEditing}
        {#if reportDialog && !isEditable}
          <Button variant="outline" size="sm" onclick={() => reportDialog?.showDialog(version.id, version.semver, `version`)}>
            <MegaphoneIcon class="h-4 w-4" />
            {m[`common.buttons.report`]()}
          </Button>
        {/if}
        <DownloadButton variant="outline" size="sm" downloadType="mod" status={version.status} href={getVersionDownloadUrl(version)}>
          <DownloadIcon class="h-4 w-4" />
          {m[`common.buttons.download`]()}
        </DownloadButton>
      {/if}
    </div>
  </div>
</div>
