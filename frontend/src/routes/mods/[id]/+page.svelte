<script lang="ts">
  import { navigating } from "$app/state";
  import ApprovalDialog from "$lib/components/dialogs/ApprovalDialog.svelte";
  import CodeDialog from "$lib/components/dialogs/CodeDialog.svelte";
  import Markdown from "$lib/components/generic/Markdown.svelte";
  import VersionCard from "$lib/components/mods/VersionCard.svelte";
  import { m } from "$lib/paraglide/messages";
  import { type UserApiV3, UserPermissions } from "$lib/scripts/api/DBTypes.js";
  import { checkRoles } from "$lib/scripts/utils/checkRoles.js";
  import { getRelativeTimeString, getStatusString } from "$lib/scripts/utils/stylizer.js";
  import { Separator } from "$shadcn/components/ui/separator";
  import { Skeleton } from "$shadcn/components/ui/skeleton";
  import * as Tooltip from "$shadcn/components/ui/tooltip/index.js";
  import Input from "$shadcn/components/ui/input/input.svelte";
  import { Button } from "$shadcn/components/ui/button/index.js";
  import { Label } from "$shadcn/components/ui/label";
  import * as Tabs from "$shadcn/components/ui/tabs/index.js";
  import Textarea from "$shadcn/components/ui/textarea/textarea.svelte";
  import * as Select from "$shadcn/components/ui/select";
  import { CrossIcon, PlusIcon, XIcon } from "@lucide/svelte";
  import UserBadge from "$lib/components/users/UserBadge.svelte";
  import UserSelectionDialog from "$lib/components/dialogs/UserSelectionDialog.svelte";
  import { zAsset, zProject } from "$lib/scripts/api/validators";
  import { toast } from "svelte-sonner";
  import { handleTrpcError, trpc } from "$lib/scripts/utils/api.js";
  import { invalidateAll } from "$app/navigation";

  const { data: _internal } = $props();
  const {
    pageData: {
      pnv: { project, versions },
      games: { game, gameVersions },
    },
    user,
  } = $derived(_internal);

  // svelte-ignore non_reactive_update
  let approvalDialog = $state<ApprovalDialog>();
  // svelte-ignore non_reactive_update
  let codeDialog = $state<CodeDialog>();
  // svelte-ignore non_reactive_update
  let userSelectionDialog = $state<UserSelectionDialog>();

  let shouldAllowApproval = $derived.by(() => {
    if (!user) return false;
    return checkRoles(
      user,
      {
        hasOneOf: [UserPermissions.Mods_Approval],
      },
      project.gameName,
    );
  });

  let shouldAllowStatusHistory = $derived.by(() => {
    if (!user) return false;
    if (project.authors.some((a) => a.id === user.id)) return true;
    if (versions.some((v) => v.uploaderId === user.id)) return true;
    if (versions.some((v) => v.statusHistory.some((sh) => sh.userId === user.id))) return true;
    return checkRoles(
      user,
      {
        hasOneOf: [UserPermissions.Mods_Approval, UserPermissions.Secret_Features],
      },
      project.gameName,
    );
  });

  let shouldAllowEdit = $derived.by(() => {
    if (!user) return false;
    if (project.authors.some((a) => a.id === user.id)) return true;
    return checkRoles(
      user,
      {
        hasOneOf: [UserPermissions.Mods_EditAll],
      },
      project.gameName,
    );
  });

  let shouldAllowTranslation = $derived.by(() => {
    if (!user) return false;
    return checkRoles(user, { hasOneOf: [UserPermissions.Mods_EditAll, UserPermissions.Mods_TranslateAll] }, project.gameName);
  });

  let isEditing = $state(false);
  let editedSummary = $state(``);
  let editedDescription = $state(``);
  let editedCategory = $state(``);
  let editedAuthors = $state<UserApiV3[]>([]);
  let editedGitUrl = $state(``);
  let editedIconFile: FileList | undefined = $state();

  let isTranslating = $state(false);
  let translatingLanguage = $state(``);
  let translationName = $state(``);
  let translationDescription = $state(``);
  let translationSummary = $state(``);

  $effect(() => {
    if (!navigating) return;
    isEditing = false;
    editedSummary = project.summary;
    editedDescription = project.description;
    editedCategory = project.category;
    editedAuthors = project.authors;
    editedGitUrl = project.gitUrl;

    isTranslating = false;
    translatingLanguage = ``;
    translationName = ``;
    translationDescription = ``;
    translationSummary = ``;
  });

  let isSaving = $state(false);
  function onSaveChangesEditing() {
    let userIds = editedAuthors.map((a) => a.id);
    let parsed = zProject
      .pick({
        summary: true,
        description: true,
        category: true,
        gitUrl: true,
        authorIds: true,
      })
      .safeParse({
        summary: editedSummary,
        description: editedDescription,
        category: editedCategory,
        gitUrl: editedGitUrl,
        authorIds: userIds,
      });

    if (!parsed.success) {
      toast.error("Please fill out all fields correctly.");
      return;
    }

    isSaving = true;
    trpc.internal.updateThings.updateProject
      .mutate({
        projectId: project.id,
        data: parsed.data,
      })
      .then(() => {
        toast.success("Project updated successfully.");
        invalidateAll().then(() => {
          isEditing = false;
          isSaving = false;
        });
      })
      .catch((e) => {
        let error = handleTrpcError(false, `full`)(e);
        toast.error("Failed to update project.", {
          description: error.formattedMessage,
        });
        isSaving = false;
      });
  }

  function onSaveChangesTranslating(type: `name` | `summary` | `description`) {
    let stringToUse: string = "";
    if (type === `name`) stringToUse = translationName;
    else if (type === `summary`) stringToUse = translationSummary;
    else if (type === `description`) stringToUse = translationDescription;

    if (!stringToUse || stringToUse.trim() === ``) {
      toast.error("Please fill out all fields correctly.");
      return;
    }

    isSaving = true;
    trpc.internal.translation.createOrUpdateTranslationForProject
      .mutate({
        projectId: project.id,
        contentType: type,
        language: translatingLanguage,
        translatedString: stringToUse,
      })
      .then(() => {
        toast.success("Translation saved successfully.");
        invalidateAll().then(() => {
          isTranslating = false;
          isSaving = false;
        });
      })
      .catch((e) => {
        let error = handleTrpcError(false, `full`)(e);
        toast.error("Failed to save translation.", {
          description: error.formattedMessage,
        });
        isSaving = false;
      });
  }
</script>

<div class="flex flex-col gap-4 m-auto w-[90%] max-w-[95%]">
  <!-- Top Bar -->
  <div class="flex flex-row grow items-center">
    <!-- <img src={pageData.project.iconFileName} alt="Project Thumbnail" class="w-32 h-32 object-cover rounded-lg mb-4" /> -->
    <Skeleton class="w-32 h-32 rounded-lg" />
    <div class="flex flex-col ml-4">
      <h1 class="text-3xl font-bold mb-1">{project.name}</h1>
      <p class="text-gray-600 mb-2">{project.summary}</p>
      <div class="flex items-center gap-2 mb-2">
        {#each project.authors as author (author.id)}
          <UserBadge user={author} />
        {/each}
      </div>
    </div>
    <div class="grid grid-cols-1 gap-2 ml-auto">
      {#if shouldAllowEdit}
        {#if !isEditing}
          <Button variant="outline" class="ml-auto w-full" onclick={() => (isEditing = true)}>{m[`dialogs.edit`]()}</Button>
        {/if}
      {/if}
      {#if shouldAllowTranslation}
        {#if !isTranslating}
          <Button variant="outline" class="ml-auto w-full" onclick={() => (isTranslating = true)}>{m[`dialogs.translate`]()}</Button>
        {/if}
      {/if}
    </div>
  </div>
  <Separator />
  <div class="flex flex-row gap-4">
    <!-- Version List -->
    <div class="w-md max-w-sm">
      {#if versions.length > 0}
        <div class="flex flex-col gap-2">
          {#each versions as version}
            <VersionCard {version} approvalDialog={shouldAllowApproval ? approvalDialog : undefined} showStatusHistory={shouldAllowStatusHistory} {codeDialog} isEditable={shouldAllowEdit} {gameVersions} />
          {/each}
        </div>
      {/if}
    </div>
    <div class="w-full">
      <!-- Databar -->
      <div class="flex justify-evenly bg-card rounded-md p-4 mb-4">
        <div class="flex flex-col items-center justify-center">
          <p class="text-sm text-gray-500">{m["mods.dataTable.status"]()}</p>
          <p class="text-base font-bold">{getStatusString(project.status)}</p>
        </div>
        <div class="flex flex-col items-center justify-center">
          <p class="text-sm text-gray-500">{m["mods.dataTable.game"]()}</p>
          <p class="text-base font-bold">{game.displayName}</p>
        </div>
        <div class="flex flex-col items-center justify-center">
          <p class="text-sm text-gray-500">{m["mods.dataTable.category"]()}</p>
          <p class="text-base font-bold">{project.category}</p>
        </div>
        <div class="flex flex-col items-center justify-center">
          <p class="text-sm text-gray-500">{m["mods.dataTable.createdAt"]()}</p>
          <Tooltip.Root>
            <Tooltip.Trigger class="text-base font-bold">
              {getRelativeTimeString(new Date(project.createdAt))}
            </Tooltip.Trigger>
            <Tooltip.Content class="bg-card text-card-foreground rounded-md p-2 text-sm">
              {new Date(project.createdAt).toLocaleString()}
            </Tooltip.Content>
          </Tooltip.Root>
        </div>
      </div>
      <!-- Description/edit window -->
      {#if isEditing}
        <div class="flex flex-col gap-4 mx-2">
          <div class="grid grid-cols-[1fr_6fr] gap-2">
            <Label for="icon">{m[`mods.dataTable.icon`]()}</Label>
            <div class="flex flex-row items-center gap-2">
              <Input id="icon" type="file" accept="image/*" bind:files={editedIconFile} />
              <Button
                variant="outline"
                disabled={!editedIconFile || editedIconFile?.length === 0}
                onclick={() => {
                  if (!editedIconFile || editedIconFile.length === 0) {
                    toast.error("Please select an icon to upload.");
                    return;
                  }
                  trpc.internal.updateThings.updateProjectIcon
                    .mutate({
                      projectId: project.id,
                      icon: editedIconFile[0] as File,
                    })
                    .then(() => {
                      toast.success("Icon updated successfully.");
                      invalidateAll();
                    })
                    .catch((e) => {
                      let error = handleTrpcError(false, `full`)(e);
                      toast.error("Failed to update icon.", {
                        description: error.formattedMessage,
                      });
                    });
                }}>
                Upload & Save Icon
              </Button>
            </div>
            <Label for="summary">{m["mods.dataTable.summary"]()}</Label>
            <Input id="summary" bind:value={editedSummary} />
            <Label for="sourceurl">{m["mods.dataTable.sourceUrl"]()}</Label>
            <Input id="sourceurl" bind:value={editedGitUrl} />
            <Label for="category">{m["mods.dataTable.category"]()}</Label>
            <Select.Root type="single" bind:value={editedCategory}>
              <Select.Trigger class="w-full" id="category">
                {editedCategory}
              </Select.Trigger>
              <Select.Content class="w-full">
                {#if project.category === `Core` || checkRoles(user, [UserPermissions.Mods_Approval], project.gameName)}
                  <Select.Item value={`Core`}>Core</Select.Item>
                {/if}
                {#if project.category === `Essential` || checkRoles(user, [UserPermissions.Mods_Approval], project.gameName)}
                  <Select.Item value={`Essential`}>Essential</Select.Item>
                {/if}
                {#each game.categories.filter((v) => v !== `Core` && v !== `Essential`) || [] as category}
                  <Select.Item value={category}>{category}</Select.Item>
                {/each}
              </Select.Content>
            </Select.Root>
            <Label for="authors">{m["mods.dataTable.authors"]()}</Label>
            <div class="flex flex-row justify-start items-center gap-2" id="authors">
              {#each editedAuthors as author, index (author.id)}
                <UserBadge user={author} onClick={() => (editedAuthors = editedAuthors.filter((_, i) => i !== index))} />
              {/each}
              <Button
                variant="ghost"
                class="rounded-full"
                size="sm"
                onclick={() =>
                  userSelectionDialog?.showDialog((selectedUser) => {
                    editedAuthors = [...editedAuthors, selectedUser];
                  })}>
                <PlusIcon class="w-2 h-2" />
              </Button>
            </div>
          </div>
          <div>
            <Tabs.Root value="edit" class="w-full">
              <Tabs.List class="border-b w-full">
                <Tabs.Trigger value="edit">{m[`dialogs.edit`]()}</Tabs.Trigger>
                <Tabs.Trigger value="preview">{m[`dialogs.preview`]()}</Tabs.Trigger>
              </Tabs.List>
              <Tabs.Content value="edit">
                <Textarea class="w-full h-64 mt-2" bind:value={editedDescription} />
              </Tabs.Content>
              <Tabs.Content value="preview">
                <Markdown class="p-4 rounded-md bg-card mt-2" bind:markdown={editedDescription} />
              </Tabs.Content>
            </Tabs.Root>
          </div>
        </div>
        <div class="flex justify-end gap-2 mt-4">
          <Button variant="outline" onclick={() => (isEditing = false)} disabled={isSaving}>{m[`dialogs.cancel`]()}</Button>
          <Button
            disabled={!zProject
              .pick({
                summary: true,
                description: true,
                category: true,
                gitUrl: true,
              })
              .safeParse({
                summary: editedSummary,
                description: editedDescription,
                category: editedCategory,
                gitUrl: editedGitUrl,
              }).success ||
              editedAuthors.length === 0 ||
              isSaving}
            onclick={onSaveChangesEditing}>
            {#if isSaving}
              Saving...
            {:else}
              {m["dialogs.saveChanges"]()}
            {/if}
          </Button>
        </div>
      {:else if isTranslating}
        <div class="flex flex-col gap-4 mx-2">
          <div class="grid grid-cols-[1fr_6fr] gap-2">
            <Label for="language">{m["mods.translation.language"]()}</Label>
            <div class="flex flex-row items-center gap-2">
              <Input id="language" bind:value={translatingLanguage} placeholder="e.g. 'fr' for French" />
            </div>
            <Label for="name">{m[`mods.dataTable.name`]()}</Label>
            <div class="flex flex-row items-center gap-2">
              <Input id="name" bind:value={translationName} />
              <Button disabled={!translatingLanguage || translatingLanguage.trim() === "" || isSaving} onclick={() => onSaveChangesTranslating(`name`)}>
                {#if isSaving}
                  {m["dialogs.saving"]()}
                {:else}
                  {m["dialogs.save"]()}
                {/if}
              </Button>
            </div>
            <Label for="summary">{m["mods.dataTable.summary"]()}</Label>
            <div class="flex flex-row items-center gap-2">
              <Input id="summary" bind:value={translationSummary} />
              <Button disabled={!translatingLanguage || translatingLanguage.trim() === "" || isSaving} onclick={() => onSaveChangesTranslating(`summary`)}>
                {#if isSaving}
                  {m["dialogs.saving"]()}
                {:else}
                  {m["dialogs.save"]()}
                {/if}
              </Button>
            </div>
          </div>
          <div>
            <Tabs.Root value="edit" class="w-full">
              <Tabs.List class="border-b w-full">
                <Tabs.Trigger value="edit">{m[`dialogs.edit`]()}</Tabs.Trigger>
                <Tabs.Trigger value="preview">{m[`dialogs.preview`]()}</Tabs.Trigger>
                <Tabs.Trigger value="viewOriginal">{m[`mods.translation.viewOriginal`]()}</Tabs.Trigger>
                <Tabs.Trigger value="viewOriginalPreview">{m[`mods.translation.viewOriginalMarkdown`]()}</Tabs.Trigger>
              </Tabs.List>
              <Tabs.Content value="edit">
                <Textarea class="w-full h-64 mt-2" bind:value={translationDescription} />
              </Tabs.Content>
              <Tabs.Content value="preview">
                <Markdown class="p-4 rounded-md bg-card mt-2" bind:markdown={translationDescription} />
              </Tabs.Content>
              <Tabs.Content value="viewOriginal">
                <Textarea class="w-full h-64 mt-2" readonly bind:value={project.description} />
              </Tabs.Content>
              <Tabs.Content value="viewOriginalPreview">
                <Markdown class="p-4 rounded-md bg-card mt-2" markdown={project.description} />
              </Tabs.Content>
            </Tabs.Root>
          </div>
        </div>
      {:else}
        <Markdown class="p-4 rounded-md bg-card" markdown={project.description} />
      {/if}
    </div>
  </div>
</div>

<ApprovalDialog bind:this={approvalDialog} />
<CodeDialog bind:this={codeDialog} />
<UserSelectionDialog bind:this={userSelectionDialog} />
