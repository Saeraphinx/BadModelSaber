<script lang="ts">
  import { m } from "$lib/paraglide/messages";
  import { zProject } from "$lib/scripts/from_backend/validators.js";
  import { Button } from "$shadcn/components/ui/button";
  import { Input } from "$shadcn/components/ui/input";
  import { Label } from "$shadcn/components/ui/label";
  import * as Select from "$shadcn/components/ui/select/index.js";
  import { Textarea } from "$shadcn/components/ui/textarea";
  import { onMount } from "svelte";
  import { handleTrpcSuccessWithToast, handleTrpcErrorWithToast } from "../../../lib/scripts/utils/api.js";
  import * as HoverCard from "../../../lib/shadcn/components/ui/hover-card/index.js";
  import { InfoIcon } from "@lucide/svelte";
  import { goto } from "$app/navigation";

  const { data: _internal } = $props();
  const { trpc } = $derived(_internal);

  let projectName = $state("");
  let projectNameId = $state("");
  let projectSummary = $state("");
  let projectDescription = $state("");
  let projectCategory = $state(`Other`);
  let projectGameName = $state(``);
  let projectGitUrl = $state("");
  let projectThumbnail: FileList | undefined = $state(undefined);

  let gameOptions: {
    name: string;
    displayName: string;
    categories: string[];
    platforms: string[];
    webhooks: any;
    isDefault: boolean;
  }[] = $state([]);

  let selectedGame = $derived.by(() => {
    return gameOptions.find((game) => game.name === projectGameName);
  });
  let selectedGameCategories: string[] = $derived.by(() => {
    const game = gameOptions.find((game) => game.name === projectGameName);
    return game ? game.categories : [];
  });

  let isNameValid: boolean = $derived(zProject.shape.name.safeParse(projectName).success);
  let isNameIdValid: boolean = $derived(zProject.shape.nameId.safeParse(projectName).success);
  let isSummaryValid: boolean = $derived(zProject.shape.summary.safeParse(projectSummary).success);
  let isDescriptionValid: boolean = $derived(zProject.shape.description.safeParse(projectDescription).success);
  let isGitUrlValid: boolean = $derived(zProject.shape.gitUrl.safeParse(projectGitUrl).success);
  let isThumbnailValid: boolean = $derived.by(() => {
    if (!projectThumbnail || projectThumbnail.length === 0) {
      return false; // Thumbnail is optional
    }
    const file = projectThumbnail[0];
    const validTypes = ["image/png", "image/jpeg", "image/webp", "image/gif"];
    console.log(file.type);
    console.log(validTypes);
    console.log(validTypes.includes(file.type));
    return validTypes.includes(file.type);
  });
  let isAllValid: boolean = $derived(
      isNameValid &&
      isNameIdValid &&
      isSummaryValid &&
      isDescriptionValid &&
      isGitUrlValid &&
      isThumbnailValid
  );
  
  function saveDataToLocalStorage() {
    localStorage.setItem(`createProjectData`, JSON.stringify({ 
      projectName, 
      projectNameId, 
      projectSummary, 
      projectDescription, 
      projectCategory, 
      projectGameName, 
      projectGitUrl,
    }));
  }

  onMount(async () => {
    await trpc.v3.games.getGames.query().then((games) => {
      let defaultGame = games.find((game) => game.isDefault === true);
      if (defaultGame) {
        projectGameName = defaultGame.name;
        projectCategory = defaultGame.categories[0] == `Core` ? `Other` : defaultGame.categories[1] || `Other`;
      }
      gameOptions = games;
    });
    // on load, try to load saved data from local storage
    const savedDataString = localStorage.getItem(`createProjectData`);
    if (savedDataString) {
      const savedData = JSON.parse(savedDataString);
      projectName = savedData.projectName || "";
      projectNameId = savedData.projectNameId || "";
      projectSummary = savedData.projectSummary || "";
      projectDescription = savedData.projectDescription || "";
      projectCategory = savedData.projectCategory || `Other`;
      projectGameName = savedData.projectGameName || "";
      projectGitUrl = savedData.projectGitUrl || "";
    }
  });

  async function submitProject() {
    let formData = new FormData();
    formData.append(
      "data",
      JSON.stringify({
        name: projectName,
        nameId: projectNameId.trim() == `` ? projectName.replaceAll(` `, ``) : projectNameId,
        summary: projectSummary,
        description: projectDescription,
        category: projectCategory,
        gameName: projectGameName,
        gitUrl: projectGitUrl,
      })
    );
    if (projectThumbnail && projectThumbnail.length > 0) {
      formData.append("icon_1", projectThumbnail[0]);
    }

    console.log("Submitting asset with data:", formData.get("data"));
    let newProject = await trpc.v3.upload.projectCreate.mutate(formData).then(handleTrpcSuccessWithToast(m[`toasts.submit.success`](), false, (newProject) => {
      localStorage.removeItem(`createProjectData`);
      goto(`/mods/${newProject.id}`);
    })).catch(handleTrpcErrorWithToast(m[`toasts.submit.error`]()));
  }
</script>

<div class="flex flex-col text-center w-full p-4">
  <h1 class="text-2xl font-bold mb-4">{m[`mods.createProject.title`]()}</h1>
  <p class="text-base mb-4">{m[`mods.createProject.subtitle`]()}</p>
</div>
<div class="flex flex-row flex-wrap justify-center p-4 gap-4" oninput={saveDataToLocalStorage}>
  <div class="flex flex-col w-full max-w-sm">
    <!-- left side -->
    <div class="flex flex-col justify-center w-full max-w-md p-4 gap-2 bg-card rounded-lg shadow-md">
      <span>
        <Label class="p-1 pb-2" for="name">{m[`common.dataTable.name`]()}</Label>
        <Input bind:value={projectName} aria-invalid={!isNameValid} id="name" />
      </span>
      <span>
        <Label class="p-1 pb-2" for="summary">
          {m[`common.dataTable.nameId`]()}
          <HoverCard.Root>
            <HoverCard.Trigger class="">
              <InfoIcon class="h-4 w-4 text-gray-500" />
            </HoverCard.Trigger>
            <HoverCard.Content class="bg-card p-2 rounded shadow-md">
              <p class="text-sm text-foreground">{m[`mods.nameIdExplanation`]()}</p>
            </HoverCard.Content>
          </HoverCard.Root>
        </Label>
        <Input bind:value={projectNameId} aria-invalid={!isNameIdValid} id="summary" placeholder={projectName.replaceAll(` `, ``)} />
      </span>
      <span>
        <Label class="p-1 pb-2" for="game">{m[`common.dataTable.game`]()}</Label>
        <Select.Root type="single" bind:value={projectGameName}>
          <Select.Trigger class="w-full">
            {selectedGame ? selectedGame.displayName : ""}
          </Select.Trigger>
          <Select.Content>
            {#each gameOptions as game}
              <Select.Item value={game.name}>{game.displayName}</Select.Item>
            {/each}
          </Select.Content>
        </Select.Root>
      </span>
      <span>
        <Label class="p-1 pb-2" for="category">{m[`common.dataTable.category`]()}</Label>
        <Select.Root type="single" bind:value={projectCategory}>
          <Select.Trigger class="w-full">
            {projectCategory}
          </Select.Trigger>
          <Select.Content>
            {#each selectedGameCategories as category}
              <Select.Item value={category}>{category}</Select.Item>
            {/each}
          </Select.Content>
        </Select.Root>
      </span>
      <span>
        <Label class="p-1 pb-2" for="gitUrl">{m[`common.dataTable.sourceUrl`]()}</Label>
        <Input bind:value={projectGitUrl} aria-invalid={!isGitUrlValid} id="gitUrl" />
      </span>
    </div>
    <div class="flex flex-col justify-center w-full max-w-md p-4 bg-card rounded-lg shadow-md mt-4">
      <p>{m[`mods.createProject.thumbnailRuleListHeader`]()}</p>
      <ul class="list-disc ml-6">
        <li>{m[`mods.createProject.thumbnailRuleList1`]()}</li>
        <li>{m[`mods.createProject.thumbnailRuleList2`]()}</li>
        <li>{m[`mods.createProject.thumbnailRuleList3`]()}</li>
        <li>{m[`mods.createProject.thumbnailRuleList4`]()}</li>
      </ul>
    </div>
    <div class="flex flex-col justify-center w-full max-w-md p-4 bg-card rounded-lg shadow-md mt-4">
      <!-- value is the first file in the files array -->
      <Label class="p-1 pb-2" for="thumbnail">{m[`common.dataTable.icon`]()}</Label>
      <Input id="thumbnail" aria-invalid={!isThumbnailValid} type="file" bind:files={projectThumbnail} accept=".png,.jpeg,.webp,.gif" />
      <p class="text-sm text-muted-foreground mt-2 pl-1">{m[`mods.createProject.thumbnailFooter`]()}</p>
    </div>
  </div>
  <div class="flex flex-col w-full max-w-2xl">
    <!-- right side -->
    <div class="flex flex-col justify-center w-full max-w-2xl p-4 gap-2 bg-card rounded-lg shadow-md">
      <span>
        <Label class="p-1 pb-2" for="summary">{m[`common.dataTable.summary`]()}</Label>
        <Textarea class="min-h-10 max-h-27 h-10" bind:value={projectSummary} aria-invalid={!isSummaryValid} id="summary" />
      </span>
      <span>
        <Label class="p-1 pb-2" for="description">{m[`common.dataTable.description`]()}</Label>
        <Textarea class="min-h-64" bind:value={projectDescription} aria-invalid={!isDescriptionValid} id="description" />
      </span>
    </div>
    <div class="flex flex-col justify-center w-full max-w-2xl p-4 bg-card rounded-lg shadow-md mt-4">
      <Button class="w-full" onclick={submitProject} disabled={!isAllValid}>{m[`dialogs.submit`]()}</Button>
    </div>
  </div>
</div>
