<script lang="ts">
  import { Status, Tags, UserPermissions, type AssetApiV3 } from "$lib/scripts/from_backend/DBExtras.js";
  import AssetCard from "$lib/components/assets/AssetCard.svelte";
  import Badge from "$shadcn/components/ui/badge/badge.svelte";
  import Button from "$shadcn/components/ui/button/button.svelte";
  import * as Carousel from "$shadcn/components/ui/carousel/index.js";
  import Separator from "$shadcn/components/ui/separator/separator.svelte";
  import { type CarouselAPI } from "$shadcn/components/ui/carousel/context.js";
  import {
    BadgeAlert,
    ClipboardCopyIcon,
    CloudDownloadIcon,
    DownloadIcon,
    Edit,
    MegaphoneIcon,
    PlusIcon,
    SquarePenIcon,
  } from "@lucide/svelte";
  import { MediaQuery } from "svelte/reactivity";
  import { navigating } from "$app/state";
  import Skeleton from "$shadcn/components/ui/skeleton/skeleton.svelte";
  import CarouselNavigator from "$lib/components/generic/CarouselNavigator.svelte";
  import { getOneClickUrl, getAssetDownloadUrl, getThumbnailUrl, parseErrorMessage } from "$lib/scripts/utils/api.js";
  import ApprovalPopup from "$lib/components/dialogs/ApprovalDialog.svelte";
  import { onMount } from "svelte";
  import { toast } from "svelte-sonner";
  import { getAssetTypeData, getRenderingMethodString, getRenderingMethodSupportedGV, getStatusString } from "$lib/scripts/utils/stylizer";
  import TagBadge from "$lib/components/assets/TagBadge.svelte";
  import Input from "$shadcn/components/ui/input/input.svelte";
  import Textarea from "$shadcn/components/ui/textarea/textarea.svelte";
  import TagPickerDialog from "$lib/components/dialogs/TagPickerDialog.svelte";
  import { zAsset } from "$lib/scripts/from_backend/validators.js";
  import { cn } from "$shadcn/utils";
  import LinkAssetDialog from "$lib/components/dialogs/LinkAssetDialog.svelte";
  import { invalidateAll } from "$app/navigation";
  import AssetPreview from "$lib/components/assets/AssetPreview.svelte";
  import StatusHoverCard from "$lib/components/generic/StatusHoverCard.svelte";
  import DownloadButton from "$lib/components/generic/DownloadButton.svelte";
  import ReportDialog from "$lib/components/dialogs/ReportDialog.svelte";
  import { m } from "$lib/paraglide/messages.js";
  import { checkRoles } from "$lib/scripts/utils/checkRoles.js";
  import Markdown from "$lib/components/generic/Markdown.svelte";
  import * as Tabs from "$shadcn/components/ui/tabs/index.js";

  const { data: _internal } = $props();
  const { trpc, user, pageData } = $derived(_internal);
  const typeData = $derived.by(() => getAssetTypeData(pageData.type));

  let mobileView = new MediaQuery("max-width: 767px"); // something something inclusivity
  let iconApi = $state<CarouselAPI>();
  let relatedApi = $state<CarouselAPI>();
  let authorApi = $state<CarouselAPI>();
  let approvalDialog: ApprovalPopup;
  let reportDialog: ReportDialog;
  let addRelatedDialog: LinkAssetDialog;

  // #region Report
  let allowedToReport = $derived.by(() => {
    if (!user) return false;
    if (user.id === pageData.uploaderId) return false; // Can't report your own asset
    return true; // Allow reporting if the user is logged in and not the uploader
  });
  // #endregion
  // #region Editing
  let allowedToEdit = $derived.by(() => {
    if (!user) return false;
    if (checkRoles(user, [UserPermissions.Asset_EditAll], pageData.gameName)) return true;
    if (pageData.uploaderId === user.id) return true;
    return false;
  });
  let isEditing = $state<boolean>(false);
  // svelte-ignore state_referenced_locally
  let editName = $state<string>(pageData.name);
  // svelte-ignore state_referenced_locally
  let editDescription = $state<string>(pageData.description || "");
  // svelte-ignore state_referenced_locally
  let editTags = $state<Tags[]>((pageData.tags as Tags[]) || []);
  let openTagPicker = $state<boolean>(false);
  let isPendingSave = $derived.by(() => {
    return editName !== pageData.name || editDescription !== pageData.description || !editTags.every((tag) => pageData.tags.includes(tag));
  });
  let zAssetName = $derived.by(() => zAsset.shape.name.safeParse(editName));
  let zAssetDescription = $derived.by(() => zAsset.shape.description.safeParse(editDescription));
  let isBlurred = $derived<boolean>(pageData.tags.includes(Tags.NSFW));
  //#endregion

  // #region Edit Submissions
  function saveChanges() {
    if (!isPendingSave) {
      return;
    }

    if (!zAssetName.success && !zAssetDescription.success) {
      toast.error(m["toasts.error.validationTitle"]());
      return;
    }

    trpc.internal.updateThings.updateAsset
      .mutate({
        assetId: pageData.id,
        data: {
          name: editName,
          description: editDescription,
          tags: editTags,
        },
      })
      .then((res) => {
        toast.success(m["toasts.success.savedChanges"]());
        invalidateAll().then(() => {
          isEditing = false;
        });
      })
      .catch((err) => {
        console.error("Error saving changes:", err);
        toast.error(m["toasts.error.generic"](), { description: parseErrorMessage(err) });
      });
  }
  // #endregion

  // #region Loading
  let isRelatedLoading = $state<boolean>(true);
  let relatedAssets = $state<AssetApiV3[]>([]);
  let isAuthorLoading = $state<boolean>(true);
  let authorAssets = $state<AssetApiV3[]>([]);

  onMount(async () => {
    let pa = Promise.resolve()
    if (pageData.linkedIds.length > 0) {
      pa = trpc.v3.assets.getMultipleAssetsById
        .query({ id: pageData.linkedIds.map((li) => li.id).splice(0, 15) })
        .then((res) => {
          relatedAssets = res ? Object.values(res) : [];
          isRelatedLoading = false;
        })
        .catch((err) => {
          toast.error(m["toasts.failedTo.loadAssets"]());
          isRelatedLoading = false;
        });
    } else {
      isRelatedLoading = false;
    }
    let pb=trpc.v3.user.getAssetsByUserId
      .query({ id: pageData.uploaderId, limit: 15 })
      .then((res) => {
        authorAssets = res.assets.filter((i) => i.id !== pageData.id) || [];
        isAuthorLoading = false;
      })
      .catch((err) => {
        toast.error(m["toasts.failedTo.loadAssets"]());
        isAuthorLoading = false;
      });
    await Promise.all([pa, pb]);
  });

  $effect(() => {
    if (!navigating) return;
    isEditing = false;
    editName = pageData.name;
    editDescription = pageData.description || "";
    editTags = (pageData.tags as Tags[]) || [];
    openTagPicker = false;
    isBlurred = pageData.tags.includes(Tags.NSFW);
  });
  // #endregion
</script>

<!-- #region Datatable -->
{#snippet dT_Regular(title = "Title", value = "", includeDiv = true)}
  {#if includeDiv}
    <div class="flex justify-between items-center">
      <span class="text-muted-foreground pr-1">{title}</span>
      <span class="font-medium text-primary">{value}</span>
    </div>
  {:else}
    <span class="text-muted-foreground pr-1">{title}</span>
    <span class="font-medium text-primary">{value}</span>
  {/if}
{/snippet}

{#snippet dataTable()}
  <!-- Shows upload date, license, etc in a table format -->
  <div class="mt-4 w-full bg-card rounded-lg border border-border p-4">
    <div class="flex flex-col gap-3 overflow-hidden">
      <div class="flex justify-between items-center">
        <span class="text-muted-foreground">{m["assets.dataTable.uploadedBy"]()}</span>
        <a href="/users/{pageData.uploaderId}" class="font-medium text-primary hover:underline">{pageData.uploader?.displayName}</a>
      </div>
      <div class="flex justify-between items-center">
        <span class="text-muted-foreground">{m["assets.dataTable.tags"]()}</span>
        <div class="flex flex-wrap gap-1 max-w-[70%] justify-end">
          {#if !isEditing}
            {#each pageData.tags as tag}
              <TagBadge tag={tag as Tags} />
            {:else}
              <span class="text-muted-foreground">{m["assets.dataTable.noTags"]()}</span>
            {/each}
          {:else}
            {#each editTags as tag}
              <TagBadge tag={tag as Tags} />
            {/each}
            <Badge
              variant="default"
              class="hover:bg-gray-600 cursor-pointer"
              onclick={() => {
                openTagPicker = true;
              }}>
              <SquarePenIcon />
            </Badge>
          {/if}
        </div>
      </div>
      {@render dT_Regular(m["assets.dataTable.type"](), typeData.combinedString)}
      {#if pageData.fileSize > 1024 * 1024}
        {@render dT_Regular(m["assets.dataTable.fileSize"](), `${(pageData.fileSize / (1024 * 1024)).toFixed(2)} MB`)}
      {:else}
        {@render dT_Regular(m["assets.dataTable.fileSize"](), `${(pageData.fileSize / 1024).toFixed(2)} KB`)}
      {/if}
      {#if pageData.renderingMethod}
        <div class="flex justify-between items-center">
          <span class="text-muted-foreground pr-1">{m["assets.dataTable.renderingMethod"]()}</span>
          <span class="font-medium text-right text-primary">
            {getRenderingMethodString(pageData.renderingMethod)}
            <p class="text-xs text-muted-foreground">{getRenderingMethodSupportedGV(pageData.renderingMethod)}</p>
          </span>
        </div>
      {/if}
      <div class="flex justify-between items-center">
        <span class="text-muted-foreground pr-2">{m["assets.dataTable.status"]()}</span>
        <StatusHoverCard status={pageData.status} type="asset">
          <Badge variant={pageData.status ? `outline` : `default`} class="capitalize">{getStatusString(pageData.status)}</Badge>
        </StatusHoverCard>
      </div>
      {#if pageData.license}
        <div class="flex justify-between items-center">
          <span class="text-muted-foreground">{m["assets.dataTable.license"]()}</span>
          {#if pageData.licenseUrl}
            <a href={pageData.licenseUrl} target="_blank" rel="noopener noreferrer" class="font-medium text-primary hover:underline">{m["assets.dataTable.customLicense"]()}</a>
          {:else}
            <span class="font-medium">{pageData.license.toLocaleUpperCase()}</span>
          {/if}
        </div>
      {/if}
      {#if pageData.sourceUrl}
        <div class="flex justify-between items-center">
          <span class="text-muted-foreground">{m["assets.dataTable.source"]()}</span>
          <a href={pageData.sourceUrl} target="_blank" rel="noopener noreferrer" class="font-medium text-primary hover:underline">{m["assets.dataTable.viewSource"]()}</a>
        </div>
      {/if}
      {@render dT_Regular(m["assets.dataTable.uploadAt"](), new Date(pageData.createdAt).toLocaleString())}
      {@render dT_Regular(m["assets.dataTable.lastUpdated"](), new Date(pageData.updatedAt).toLocaleString())}
      <div class="flex justify-between items-center overflow-ellipsis">
        <span class="text-muted-foreground">{m["assets.dataTable.fileHash"]()}</span>
        <div class="flex flex-row items-center gap-2 justify-end max-w-[70%]">
          <div class="block overflow-ellipsis overflow-hidden whitespace-nowrap max-w-full">
            <span class="font-mono w-full" title={pageData.fileHash}>{pageData.fileHash}</span>
          </div>
          <Button
            variant="ghost"
            size="icon"
            title="Copy File Hash"
            onclick={() => {
              navigator.clipboard.writeText(pageData.fileHash);
              toast.success("File hash copied to clipboard!");
            }}>
            <ClipboardCopyIcon />
          </Button>
        </div>
      </div>
    </div>
  </div>
{/snippet}
<!-- #endregion -->

<!-- #region Carousel -->
{#snippet iconCarousel()}
  <Carousel.Root
    setApi={(api) => {
      iconApi = api;
    }}
    opts={{ loop: true }}>
    <Carousel.Content>
      {#each pageData.icons as icon}
        <Carousel.Item>
          <div class="overflow-hidden rounded-2xl mx-8 relative">
            <img src={`${getThumbnailUrl(pageData.id, icon)}`} alt="Icon for {pageData.name}" class="w-full h-full rounded-2xl transition-all duration-300 {isBlurred ? `blur-2xl` : ``}" />
            {#if isBlurred}
              <div class="flex flex-col absolute top-0 left-0 w-full h-full justify-center items-center">
                <p class="text-green">{m["assets.nsfwWarning"]()}</p>
                <Button onclick={() => (isBlurred = false)}>{m["common.buttons.unhide"]()}</Button>
              </div>
            {/if}
          </div>
        </Carousel.Item>
      {/each}
    </Carousel.Content>
    {#if iconApi && pageData.icons.length > 1}
      <CarouselNavigator api={iconApi} numberOfDots={pageData.icons.length} />
    {/if}
  </Carousel.Root>
{/snippet}

{#snippet assetCarousel(assets: AssetApiV3[], isLoading: boolean, apiType: `author` | `related`, title = "Related Assets", ifNoFound = "No related assets found.", guessNumber = 5)}
  <div class="w-full px-2">
    <div class="flex justify-between items-center">
      <span class="text-lg font-semibold">{title}</span>
      {#if apiType === "related" && isEditing}
        <Button onclick={() => addRelatedDialog?.showDialog(pageData.id)}>
          <PlusIcon />
          {m["assets.carousels.addRelatedAsset"]()}
        </Button>
      {/if}
    </div>
    {#if assets.length === 0 && !isLoading}
      <div class="flex w-full justify-center items-center">
        <span class="text-gray-500 dark:text-gray-400 w-2xl py-8 text-center">{ifNoFound}</span>
      </div>
    {:else}
      <Carousel.Root
        class="w-full"
        setApi={(api) => {
          if (apiType === "related") {
            relatedApi = api;
          } else if (apiType === "author") {
            authorApi = api;
          }
        }}
        opts={{ loop: true }}>
        <Carousel.Content class="-ml-4">
          {#if isLoading}
            {#each { length: guessNumber }}
              <Carousel.Item class="pl-4 basis-auto">
                <Skeleton class="bg-gray-400/20 w-48 h-48 rounded-2xl" />
              </Carousel.Item>
            {/each}
          {:else}
            {#each assets as asset}
              <Carousel.Item class="pl-4 basis-auto">
                <AssetCard {asset} size="normal" />
              </Carousel.Item>
            {/each}
          {/if}
        </Carousel.Content>
        {#if apiType === "related" && relatedApi}
          <CarouselNavigator api={relatedApi} numberOfDots={assets.length} showOnlyOne={true} />
        {:else if apiType === "author" && authorApi}
          <CarouselNavigator api={authorApi} numberOfDots={assets.length} showOnlyOne={true} />
        {/if}
      </Carousel.Root>
    {/if}
  </div>
{/snippet}
<!-- #endregion -->
<!-- #region Buttons -->
{#snippet buttons(center = mobileView.current)}
  <div class={cn("flex flex-row gap-2 flex-wrap items-center", center ? "justify-center" : "justify-start")}>
    {#if !isEditing}
      <DownloadButton downloadType="asset" status={pageData.status} variant="default" href={getAssetDownloadUrl(pageData)} download>
        <DownloadIcon />
        {m["common.buttons.download"]()}
      </DownloadButton>
      <DownloadButton downloadType="asset" status={pageData.status} variant="outline" href={getOneClickUrl(pageData)}>
        <CloudDownloadIcon />
        {m["common.buttons.oneClickInstall"]()}
      </DownloadButton>
      {#if allowedToReport}
        <Button variant="destructive" onclick={() => {
          reportDialog?.showDialog(pageData.id, pageData.name);
        }}>
          <MegaphoneIcon />
          {m["common.buttons.report"]()}
        </Button>
      {/if}
      {#if user && user.id === pageData.uploaderId && pageData.status === Status.Private}
        <div class="animated-rainbow-border">
          <Button
            variant="secondary"
            onclick={() => {
              trpc.internal.updateThings.submitAssetForApproval
                .mutate({ assetId: pageData.id })
                .then(() => {
                  toast.success(m["toasts.success.assetSubmittedForApproval"]());
                })
                .catch((err) => {
                  toast.error(m["toasts.error.generic"](), { description: parseErrorMessage(err) });
                });
            }}>
            <BadgeAlert />
            {m["common.buttons.submitForApproval"]()}
          </Button>
        </div>
      {/if}
      {#if user && checkRoles(user, [UserPermissions.Asset_Approval], pageData.gameName)}
        <Button
          variant="secondary"
          onclick={() => {
            approvalDialog?.showDialog(pageData.id, pageData.name, `asset`);
          }}>
          <BadgeAlert />
          {m["common.buttons.approvalDialog"]()}
        </Button>
      {/if}
    {/if}
    {#if allowedToEdit}
      {#if isEditing}
        <Button
          variant="default"
          disabled={!isPendingSave || !zAssetName.success || !zAssetDescription.success}
          onclick={() => {
            saveChanges();
          }}>
          {m["dialogs.saveChanges"]()}
        </Button>
        <Button
          variant="secondary"
          onclick={() => {
            isEditing = !isEditing;
            editName = pageData.name;
            editDescription = pageData.description || "";
            editTags = (pageData.tags as Tags[]) || [];
          }}>
          {m["dialogs.discardChanges"]()}
        </Button>
      {:else}
        <Button
          variant="secondary"
          onclick={() => {
            isEditing = !isEditing;
          }}>
          <Edit />
          {m["dialogs.edit"]()}
        </Button>
      {/if}
    {/if}
  </div>
{/snippet}
<!-- #endregion -->

<!-- #region Editable Fields -->
{#snippet title(center = mobileView.current)}
  <div class={cn("mb-2 w-full text-center", center ? "text-center" : "text-left")}>
    {#if isEditing}
      <div class="flex flex-col w-full">
        <Input aria-invalid={!zAssetName.success} type="text" bind:value={editName} placeholder="Asset Name" class="w-full mb-2" />
        {#if !zAssetName.success}
          <span class="text-sm text-red-500 mt-1">{parseErrorMessage(zAssetName.error)}</span>
        {/if}
      </div>
    {:else}
      <span class="text-3xl font-bold">{pageData.name}</span>
    {/if}
  </div>
{/snippet}

{#snippet description()}
  {#if isEditing}
    <Tabs.Root value="edit" class="w-full">
      <Tabs.List class="bg-transparent border-b border-border mb-2">
        <Tabs.Trigger value="edit">
          {m["dialogs.edit"]()}
        </Tabs.Trigger>
        <Tabs.Trigger value="preview">
          {m["dialogs.preview"]()}
        </Tabs.Trigger>
      </Tabs.List>
      <Tabs.Content value="edit">
         <Textarea aria-invalid={!zAssetDescription.success} bind:value={editDescription} placeholder="Asset Description" class="w-full mb-2 min-h-64" />
        {#if !zAssetDescription.success}
          <span class="text-sm text-red-500 mt-1">{parseErrorMessage(zAssetDescription.error)}</span>
        {/if}
      </Tabs.Content>
      <Tabs.Content value="preview">
        <Markdown markdown={editDescription || "No description available."} class="text-lg text-gray-500 dark:text-gray-400 whitespace-pre-line text-wrap wrap-anywhere" />
      </Tabs.Content>
    </Tabs.Root>
  {:else}
    {#if pageData.status === Status.Verified}
      <Markdown markdown={pageData.description || "No description available."} class="text-lg text-gray-500 dark:text-gray-400 whitespace-pre-line text-wrap wrap-anywhere" />
    {:else}
      <span class="text-lg text-gray-500 dark:text-gray-400 whitespace-pre-line text-wrap wrap-anywhere">{pageData.description || "No description available."}</span>
    {/if}
  {/if}
{/snippet}
<!-- #endregion -->

<div class="flex flex-col items-center m-auto max-w-6xl nod-md:p-4 bg-background rounded-2xl">
  <div class="flex flex-col md:flex-row w-full">
    <div class="flex flex-col items-center w-auto min-w-[40%] md:max-w-[50%]">
      {#if mobileView.current}
        {@render title()}
      {/if}
      {@render iconCarousel()}
      {#if !mobileView.current}
        {@render dataTable()}
      {/if}
    </div>
    <div class="flex flex-col mx-6 mt-2 md:max-w-[58%]">
      <div class="flex flex-col">
        {#if !mobileView.current}
          {@render title()}
        {/if}
        {@render buttons()}
        <Separator class="my-4 w-full" />
        {@render description()}
        <Separator class="my-4 w-full" />
        <span class="text-lg font-semibold">{ m["assets.previewTitle"]()}</span>
        <AssetPreview asset={pageData} />
        <Separator class="my-4 w-full" />
        {@render assetCarousel(relatedAssets, isRelatedLoading, `related`, m["assets.carousels.relatedAssets"](), m["assets.carousels.relatedAssetsNoneFound"]())}
        <Separator class="my-4 w-full" />
        {@render assetCarousel(authorAssets, isAuthorLoading, `author`, m["assets.carousels.authorAssets"]({ name: pageData.uploader?.displayName ?? ``}), m["assets.carousels.authorAssetsNoneFound"]({ name: pageData.uploader?.displayName ?? ``}))}
        {#if mobileView.current}
          {@render dataTable()}
        {/if}
      </div>
    </div>
  </div>
</div>

<ApprovalPopup bind:this={approvalDialog} />
<LinkAssetDialog bind:this={addRelatedDialog} />
<TagPickerDialog bind:open={openTagPicker} bind:selectedTags={editTags} showInternalTags={checkRoles(user, [UserPermissions.Asset_InternalTags], pageData.gameName)} type={pageData.type} />
<ReportDialog bind:this={reportDialog} />

<style>
  @property --angle {
    syntax: "<angle>";
    initial-value: 0deg;
    inherits: false;
  }

  .animated-rainbow-border {
    position: relative;
    background: white;
    padding: 2px;
    border-radius: 10px;
    isolation: isolate; /* Creates a new stacking context */
    overflow: hidden;
  }

  .animated-rainbow-border::before {
    content: "";
    position: absolute;
    inset: -1px;
    background: conic-gradient(from var(--angle), red, orange, yellow, green, rgb(104, 104, 255), rgb(167, 53, 248), red);
    border-radius: inherit;
    z-index: -1;
    animation: rotate 3s linear infinite;
  }

  @keyframes rotate {
    to {
      --angle: 360deg;
    }
  }
</style>
