<script lang="ts">
  import DependencySelector from "$lib/components/forms/ProjectSelector.svelte";
  import { m } from "$lib/paraglide/messages.js";
  import { Status, type GameVersionApiV3 } from "$lib/scripts/api/DBTypes.js";
  import { getManifestFromFile, getManifestFromZip, type Manifest } from "$lib/scripts/api/modParser.js";
  import { manifestAllDependenciesExist, manifestGameVersionIsLowestSupportedVersion } from "$lib/scripts/utils/checkManifest.js";
  import { Button } from "$shadcn/components/ui/button";
  import * as Command from "$shadcn/components/ui/command/index.js";
  import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "$shadcn/components/ui/dialog/index.js";
  import Input from "$shadcn/components/ui/input/input.svelte";
  import Label from "$shadcn/components/ui/label/label.svelte";
  import * as Select from "$shadcn/components/ui/select";
  import { Spinner } from "$shadcn/components/ui/spinner";
  import type { LocalizedString } from "@inlang/paraglide-js";
  import { CheckIcon } from "@lucide/svelte";
  import JSZip from "jszip";
  import { parse, validRange } from "semver";
  import { onMount } from "svelte";
  import { toast } from "svelte-sonner";

  const { data: _internal } = $props();
  const { trpc, pageData } = $derived(_internal);

  let semverString = $state("");
  let platform = $state("universal");
  let supportedGameVersionIds = $state<string[]>([]);
  let webDependencies = $state<{ pId: number; pName: string; sv: string }[]>([]);
  let files: FileList | undefined = $state();

  let openDepCloneDialog = $state(false);
  let versionIdToCloneFrom = $state(-1);

  let manifest: Manifest | null = $state(null);
  let manifestIssues: LocalizedString[] = $derived.by(() => {
    if (validGameInfo === null) return [];
    if (!manifest) return [m["mods.manifestChecks.couldNotReadManifest"]()];

    let issues: LocalizedString[] = [];
    if (
      manifestGameVersionIsLowestSupportedVersion(
        manifest,
        validGameInfo.gameVersions.filter((gv) => supportedGameVersionIds.includes(gv.id.toString())),
      )
    ) {
      issues.push(m["mods.manifestChecks.manifestGameVersionIsntLowest"]({ manifestGameVersion: manifest.gameVersion }));
    }
    if (manifest.name !== pageData.name) {
      issues.push(m["mods.manifestChecks.manifestProjectNameMismatch"]({ manifestName: manifest.name, expectedName: pageData.name }));
    }
    let depIssues = manifestAllDependenciesExist(manifest, webDependencies);
    if (depIssues.length > 0) {
      issues.push(...depIssues);
    }
    return issues;
  });

  let validGameInfo = $state<{ platforms: string[]; gameVersions: GameVersionApiV3[]; gameDisplayName: string } | null>(null);

  async function getGameInfo() {
    return await trpc.v3.games.getGameVersions.query({ gameName: pageData.gameName }).then((res) => {
      return {
        platforms: res.game.platforms,
        gameVersions: res.gameVersions,
        gameDisplayName: res.game.displayName,
      };
    });
  }

  onMount(() => {
    getGameInfo().then((info) => {
      validGameInfo = info;
    });
  });

  async function getVersionsForDepCloneDialog() {
    if (!pageData.id) return;
    return await trpc.internal.mods.getProjectVerisons.query({ projectId: pageData.id });
  }

  async function loadManifest() {
    if (!files || files.length === 0) return null;
    let file = files[0];
    if (file.name.endsWith(`.zip`)) {
      manifest = await getManifestFromZip(file);
      //debugger;
    } else {
      manifest = await getManifestFromFile(file);
    }
    if (!manifest) {
      toast.error(m["mods.manifestChecks.couldNotReadManifest"]());
    }
  }

  async function submit() {
    let file = files && files.length > 0 ? files[0] : null;
    if (!file) {
      toast.error(m["toasts.error.validationTitle"](), { description: m["toasts.error.validation.invalidFile"]() });
      return;
    }

    if (file.name.endsWith(`.dll`)) {
      // put the dll in a new zip file under a folder called "Plugins"
      let zip = new JSZip();
      zip.file(`Plugins/${file.name}`, file);
      let zippedFile = await zip.generateAsync({ type: "blob" });
      file = new File([zippedFile], file.name.replace(`.dll`, `.zip`), { type: "application/zip" });
    }

    await trpc.v3.upload.versionUpload.mutate({
      id: pageData.id,
      data: {
        semver: semverString,
        platform,
        supportedGameVersionIds: supportedGameVersionIds.map((id) => parseInt(id)),
        dependencies: webDependencies.map((d) => {
          return { pId: d.pId, sv: d.sv };
        }),
      },
      modZip: file,
      immidateSubmit: false,
    });
  }
</script>

<div class="flex flex-col text-center w-full p-4">
  <h1 class="text-2xl font-bold mb-4">{m["mods.createVersion.title"]({ projectName: pageData.name })}</h1>
  <p class="text-base mb-4">{m["mods.createVersion.subtitle"]({ projectName: pageData.name })}</p>
</div>

<div class="flex flex-row flex-wrap justify-center p-4 gap-4">
  <div class="flex flex-col w-full max-w-md">
    <!-- left side -->
    <div class="flex flex-col justify-center w-full max-w-md p-4 gap-2 bg-card rounded-lg shadow-md">
      {#if validGameInfo === null}
        <p>{m["loading"]()}</p>
      {:else}
        <span>
          <Label class="p-1 pb-2" for="semver">{m["mods.dataTable.semver"]()}</Label>
          <Input bind:value={semverString} aria-invalid={!parse(semverString)} id="semver" />
          <p class="text-sm text-muted-foreground mt-2 pl-1">{m["mods.createVersion.semverShouldMatchManifest"]()}</p>
        </span>
        <span>
          <Label class="p-1 pb-2" for="platform">{m["mods.dataTable.platform"]()}</Label>
          <Select.Root type="single" bind:value={platform}>
            <Select.Trigger class="w-full capitalize">
              {#if platform === ""}
                {m["mods.dataTable.platform"]()}
              {:else}
                {platform}
              {/if}
            </Select.Trigger>
            <Select.Content class="w-full">
              {#each validGameInfo.platforms as p}
                <Select.Item class="capitalize" value={p}>
                  {p}
                </Select.Item>
              {/each}
            </Select.Content>
          </Select.Root>
        </span>
        <span>
          <Label class="p-1 pb-2" for="supportedGameVersions">{m["mods.dataTable.supportedGameVersions"]()}</Label>
          <Select.Root type="multiple" bind:value={supportedGameVersionIds}>
            <Select.Trigger class="w-full text-wrap" aria-invalid={supportedGameVersionIds.length === 0}>
              {#if supportedGameVersionIds.length === 0}
                {m["mods.dataTable.supportedGameVersions"]()}
              {:else}
                {supportedGameVersionIds.map((id) => validGameInfo?.gameVersions.find((gv) => gv.id === parseInt(id))?.version).join(", ")}
              {/if}
            </Select.Trigger>
            <Select.Content class="w-full max-h-64">
              {#each validGameInfo.gameVersions as gv}
                <Select.Item value={gv.id.toString()}>
                  {validGameInfo.gameDisplayName}
                  {gv.version}
                </Select.Item>
              {/each}
            </Select.Content>
          </Select.Root>
        </span>
      {/if}
    </div>
    <div class="flex flex-col justify-center w-full max-w-md p-4 bg-card rounded-lg shadow-md gap-2 mt-4">
      <Label class="p-1 pb-2" for="dependencies">{m["mods.dataTable.dependencies"]()}</Label>
      <div id="dependencies">
        {#each webDependencies as dep, i}
          <div class="flex flex-row gap-2">
            <DependencySelector gameName={pageData.gameName} bind:selectedProjectId={webDependencies[i].pId} bind:selectedProjectName={webDependencies[i].pName} />
            <Input bind:value={webDependencies[i].sv} placeholder={m["mods.dataTable.semver"]()} aria-invalid={validRange(dep.sv, false) ? false : true} />
            <Button variant="destructive" onclick={() => (webDependencies = webDependencies.filter((_, _i) => _i !== i))}>
              {m["dialogs.remove"]()}
            </Button>
          </div>
        {/each}
      </div>
      <Button variant="outline" class="mt-2" onclick={() => (webDependencies = [...webDependencies, { pId: -1, pName: ``, sv: "" }])}>
        {m["mods.createVersion.addDependency"]()}
      </Button>
      <Button variant="ghost" class="w-full" onclick={() => (openDepCloneDialog = true)}>{m["mods.createVersion.importFromOtherVersion"]()}</Button>
    </div>
  </div>
  <div class="flex flex-col w-full max-w-md">
    <!-- right side -->
    <div class="flex flex-col justify-center w-full max-w-md p-4 bg-card rounded-lg shadow-md">
      <span>
        <Label class="p-1 pb-2" for="zip">{m["mods.version"]()}</Label>
        <Input bind:files class="" type="file" id="zip" accept=".zip,.dll" />
      </span>
      {#if files && files[0] && files[0].name.endsWith(`.dll`)}
        <p class="text-sm text-muted-foreground mt-2 pl-1">{m["mods.createVersion.packingFileIntoZip"]()}</p>
      {/if}
    </div>
    <div class="flex flex-col justify-center w-full max-w-md p-4 bg-card rounded-lg shadow-md mt-4">
      <div class="flex flex-col gap-2">
        <h2 class="text-lg font-bold">{m["mods.manifestChecks.manifestData"]()}</h2>
        {#if manifest}
          <ol class="text-sm max-h-64 w-full overflow-auto p-2 bg-muted rounded-2xl whitespace-pre font-mono list-decimal" aria-hidden="true">
            {#each JSON.stringify(manifest, null, 2).split(`\n`) as line}
              <li>{line}</li>
            {/each} 
          </ol>
          {#if manifestIssues.length > 0}
            <div class="flex flex-col gap-2">
              <ul class="list-disc list-inside text-sm text-red-500">
                {#each manifestIssues as issue}
                  <li>{issue}</li>
                {/each}
              </ul>
            </div>
          {:else}
            <p class="text-sm text-green-500">{m["mods.manifestChecks.noIssuesFound"]()}</p>
          {/if}
        {:else}
          <Button class="w-full" variant="outline" onclick={loadManifest} disabled={!files || files.length === 0}>{m["mods.manifestChecks.loadManifest"]()}</Button>
        {/if}
      </div>
    </div>
    <div class="flex flex-col justify-center w-full max-w-md p-4 bg-card rounded-lg shadow-md mt-4">
      <Button
        class="w-full"
        disabled={semverString.length === 0 ||
          !parse(semverString) ||
          platform.length === 0 ||
          supportedGameVersionIds.length === 0 ||
          webDependencies.some((d) => d.pId === -1 || d.sv.length === 0 || !validRange(d.sv, false)) ||
          !files ||
          files.length === 0 ||
          files.length > 1}
        onclick={submit}>{m["dialogs.submit"]()}</Button>
    </div>
  </div>
</div>

<Dialog bind:open={openDepCloneDialog}>
  <DialogContent class="sm:max-w-[425px]">
    <DialogHeader>
      <DialogTitle>{m["mods.createVersion.importFromOtherVersionDialogTitle"]({ projectName: pageData.name })}</DialogTitle>
      <DialogDescription>{m["mods.createVersion.importFromOtherVersionDialogDescription"]({ projectName: pageData.name })}</DialogDescription>
    </DialogHeader>
    {#await getVersionsForDepCloneDialog()}
      <div class="flex flex-col items-center justify-center gap-4 py-4">
        <Spinner />
        <p class="text-base">{m["loading"]()}</p>
      </div>
    {:then versionsToCloneFrom}
      <div class="flex flex-row gap-4">
        <Command.Root>
          <Command.Input placeholder={m["mods.createVersion.searchVersion"]()} />
          <Command.List>
            <Command.Empty>{m["mods.noVersionsFound"]()}</Command.Empty>
            {#if versionsToCloneFrom?.length !== 0}
              {#each Object.values(Status).filter((s) => {
                return versionsToCloneFrom?.some((v) => v.status === s);
              }) as status}
                <Command.Group heading={m[`enums.status.${status}`]()}>
                  {#each versionsToCloneFrom?.filter((v) => v.status === status) as version}
                    <Command.Item
                      value={version.id.toString()}
                      onSelect={() => {
                        versionIdToCloneFrom = version.id;
                      }}>
                      {version.semver}
                      {#if versionIdToCloneFrom == version.id}
                        <CheckIcon />
                      {/if}
                    </Command.Item>
                  {/each}
                </Command.Group>
              {/each}
            {/if}
          </Command.List>
        </Command.Root>
      </div>
      <DialogFooter>
        <Button variant="outline" onclick={() => (openDepCloneDialog = false)}>{m["dialogs.cancel"]()}</Button>
        <Button
          onclick={() => {
            if (versionIdToCloneFrom === -1) return;
            let versionToCloneFrom = versionsToCloneFrom?.find((v) => v.id === versionIdToCloneFrom);
            if (!versionToCloneFrom) return;
            trpc.internal.mods.getBulkProjects
              .query({ projectIds: versionToCloneFrom.dependencies.map((d) => d.pId) })
              .then((res) => {
                webDependencies = versionToCloneFrom.dependencies.map((d) => {
                  let project = res.find((p) => p.id === d.pId);
                  return { pId: d.pId, pName: project ? project.name : `Project ${d.pId}`, sv: d.sv };
                });
                openDepCloneDialog = false;
              })
              .catch(() => {
                toast.error(m["toasts.error.generic"]());
              });
          }}>
          {m["dialogs.submit"]()}</Button>
      </DialogFooter>
    {/await}
  </DialogContent>
</Dialog>

<style>
  li {
    margin-left: 3em;
    font-family: var(--font-mono);
  }
  li::marker {
    color: var(--muted-foreground);
    margin: 0 0.5em 0 0;
  }
</style>