<script lang="ts">
  import { Status, Tags, UserPermissions, type AssetPublicAPIv3 } from "$lib/scripts/api/DBTypes.js";
  import AssetCard from "$lib/components/assets/AssetCard.svelte";
  import Badge from "$shadcn/components/ui/badge/badge.svelte";
  import Button from "$shadcn/components/ui/button/button.svelte";
  import * as Carousel from "$shadcn/components/ui/carousel/index.js";
  import Separator from "$shadcn/components/ui/separator/separator.svelte";
  import { type CarouselAPI } from "$shadcn/components/ui/carousel/context.js";
  import { BadgeAlert, Car, ChevronLeftIcon, ChevronRightIcon, CircleDot, CircleIcon, ClipboardCopyIcon, CloudDownloadIcon, DotIcon, DownloadIcon, Edit, HamburgerIcon, MegaphoneIcon, MenuIcon, PlusIcon, SquarePenIcon } from "@lucide/svelte";
  import { MediaQuery } from "svelte/reactivity";
  import { navigating, page } from "$app/state";
  import Skeleton from "$shadcn/components/ui/skeleton/skeleton.svelte";
  import CarouselNavigator from "$lib/components/generic/CarouselNavigator.svelte";
  import { fetchApiSafe, getAssetThumbnailUrl, getAssetUrl } from "$lib/scripts/utils/api.js";
  import ApprovalPopup from "$lib/components/assets/ApprovalDialog.svelte";
  import { onMount } from "svelte";
  import { toast } from "svelte-sonner";
  import { getAssetTypeData } from "$lib/scripts/utils/stylizer";
  import TagBadge from "$lib/components/assets/TagBadge.svelte";
  import Input from "$shadcn/components/ui/input/input.svelte";
  import Textarea from "$shadcn/components/ui/textarea/textarea.svelte";
  import TagPicker from "$lib/components/forms/TagPicker.svelte";
  import { zAsset } from "$lib/scripts/api/validator.js";
  import { fromZodError } from "zod-validation-error";
  import { cn } from "$shadcn/utils";
  import LinkAssetDialog from "$lib/components/assets/LinkAssetDialog.svelte";

  let { data } = $props();
  const typeData = $derived.by(() => getAssetTypeData(data.pageData.type));

  let mobileView = new MediaQuery("max-width: 767px"); // something something inclusivity
  let iconApi = $state<CarouselAPI>();
  let relatedApi = $state<CarouselAPI>();
  let authorApi = $state<CarouselAPI>();
  let approvalDialog: ApprovalPopup;
  let addRelatedDialog: LinkAssetDialog;

  // #region Report
  let allowedToReport = $derived.by(() => {
    if (!data.user) return false;
    if (data.user.id === data.pageData.uploaderId) return false; // Can't report your own asset
    return true; // Allow reporting if the user is logged in and not the uploader
  });
  // #region Editing
  let allowedToEdit = $derived.by(() => {
    if (!data.user) return false;
    if (data.user.roles.includes(UserPermissions.Edit_Any_Asset)) return true;
    if (data.pageData.uploaderId === data.user.id) return true;
    return false;
  });
  let isEditing = $state<boolean>(false);
  let editName = $state<string>(data.pageData.name);
  let editDescription = $state<string>(data.pageData.description || "");
  let editTags = $state<Tags[]>((data.pageData.tags as Tags[]) || []);
  let openTagPicker = $state<boolean>(false);
  let isPendingSave = $derived.by(() => {
    return editName !== data.pageData.name || editDescription !== data.pageData.description || !editTags.every((tag) => data.pageData.tags.includes(tag));
  });
  let zAssetName = $derived.by(() => zAsset.shape.name.safeParse(editName));
  let zAssetDescription = $derived.by(() => zAsset.shape.description.safeParse(editDescription));
  let isBlurred = $state<boolean>(data.pageData.tags.includes(Tags.NSFW));
  //#endregion

  // #region Edit Submissions
  function saveChanges() {
    if (!isPendingSave) {
      toast.info("No changes to save.");
      return;
    }

    if (!zAssetName.success && !zAssetDescription.success) {
      toast.error("Invalid asset name or description.");
      return;
    }

    fetchApiSafe(`/assets/${data.pageData.id}`, {
      method: "PUT",
      body: JSON.stringify({
        name: editName,
        description: editDescription,
        tags: editTags,
      }),
    }, data.fetch).then((res) => {
      if (res.isError) {
        toast.error(`Failed to save changes: ${res.message}`);
      } else {
        toast.success("Changes saved successfully!", {
          description: "Reload the page to see the changes.",
          duration: 100 * 60 * 60 * 24, // 24 hours
          dismissable: false,
          action: {
            label: "Reload",
            onClick: () => {
              window.location.reload();
            },
          }
        });
        isEditing = false;
      }
    }).catch((err) => {
      console.error("Error saving changes:", err);
      toast.error(`Error saving changes: ${err.message}`);
    });
  }
  // #endregion

  // #region Loading
  let isRelatedLoading = $state<boolean>(true);
  let relatedAssets = $state<AssetPublicAPIv3[]>([]);
  let isAuthorLoading = $state<boolean>(true);
  let authorAssets = $state<AssetPublicAPIv3[]>([]);

  onMount(async () => {
    if (data.pageData.linkedIds.length > 0) {
      fetchApiSafe<{ [key: string]: AssetPublicAPIv3 }>(`/multi/assets?id=${data.pageData.linkedIds.slice(0, 20).join("&id=")}`, {}, data.fetch).then((res) => {
        if (res.isError) {
          toast.error(`Failed to load related assets: ${res.message}`);
          isRelatedLoading = false;
          return;
        } else {
          relatedAssets = res.data ? Object.values(res.data) : [];
          isRelatedLoading = false;
        }
      });
    } else {
      isRelatedLoading = false;
    }
    fetchApiSafe<{ assets: AssetPublicAPIv3[] }>(`/users/${data.pageData.uploaderId}/assets?limit=10`, {}, data.fetch).then((res) => {
      if (res.isError) {
        toast.error(`Failed to load author's assets: ${res.message}`);
        isAuthorLoading = false;
        return;
      } else {
        authorAssets = res.data?.assets.filter((i) => i.id !== data.pageData.id) || [];
        isAuthorLoading = false;
      }
    });
  });

  $effect(() => {
    if (!navigating) return;
    isEditing = false;
    editName = data.pageData.name;
    editDescription = data.pageData.description || "";
    editTags = (data.pageData.tags as Tags[]) || [];
    openTagPicker = false;
    isBlurred = data.pageData.tags.includes(Tags.NSFW);
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

{#snippet dT_SingleBadge(title: string = "Title", value: string = "", badgeVariant: "outline" | "default" | "secondary" | "destructive" = "outline")}
  <div class="flex justify-between items-center">
    <span class="text-muted-foreground pr-2">{title}</span>
    <Badge variant={badgeVariant} class="capitalize">{value}</Badge>
  </div>
{/snippet}

{#snippet dataTable()}
  <!-- Shows upload date, license, etc in a table format -->
  <div class="mt-4 w-full bg-card rounded-lg border border-border p-4">
    <div class="flex flex-col gap-3 overflow-hidden">
      <div class="flex justify-between items-center">
        <span class="text-muted-foreground">Uploaded By</span>
        <a href="/users/{data.pageData.uploaderId}" class="font-medium text-primary hover:underline">{data.pageData.uploader?.displayName}</a>
      </div>
      <div class="flex justify-between items-center">
        <span class="text-muted-foreground">Tags</span>
        <div class="flex flex-wrap gap-1 max-w-[70%] justify-end">
          {#if !isEditing}
            {#each data.pageData.tags as tag}
              <TagBadge tag={tag as Tags} />
            {:else}
              <span class="text-muted-foreground">No tags selected.</span>
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
      {@render dT_Regular(`Type`, typeData.combinedString)}
      {@render dT_Regular("File Size", `${(data.pageData.fileSize / 1024 / 1024).toFixed(2)} MB`)}
      {#if data.pageData.status !== Status.Approved}
        {@render dT_SingleBadge("Status", data.pageData.status, "destructive")}
      {:else}
        {@render dT_SingleBadge("Status", data.pageData.status, "default")}
      {/if}

      {#if data.pageData.license}
        <div class="flex justify-between items-center">
          <span class="text-muted-foreground">License</span>
          {#if data.pageData.licenseUrl}
            <a href={data.pageData.licenseUrl} target="_blank" rel="noopener noreferrer" class="font-medium text-primary hover:underline">
              {data.pageData.license}
            </a>
          {:else}
            <span class="font-medium">{data.pageData.license}</span>
          {/if}
        </div>
      {/if}
      {#if data.pageData.sourceUrl}
        <div class="flex justify-between items-center">
          <span class="text-muted-foreground">Source</span>
          <a href={data.pageData.sourceUrl} target="_blank" rel="noopener noreferrer" class="font-medium text-primary hover:underline">View Source</a>
        </div>
      {/if}
      {@render dT_Regular("Uploaded", new Date(data.pageData.createdAt).toLocaleString())}
      {@render dT_Regular("Last Updated", new Date(data.pageData.updatedAt).toLocaleString())}
      <div class="flex justify-between items-center overflow-ellipsis">
          <span class="text-muted-foreground">File Hash</span>
          <div class="flex flex-row items-center gap-2 justify-end max-w-[70%]">
            <div class="block overflow-ellipsis overflow-hidden whitespace-nowrap max-w-[100%]">
              <span class="font-mono w-full" title={data.pageData.fileHash}>{data.pageData.fileHash}</span>
            </div>
            <Button
              variant="ghost"
              size="icon"
              title="Copy File Hash"
              onclick={() => {
                navigator.clipboard.writeText(data.pageData.fileHash);
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
      {#each data.pageData.icons as icon}
        <Carousel.Item>
          <div class="overflow-hidden rounded-2xl relative">
            <img src={`${getAssetThumbnailUrl(icon)}`} alt="Icon for {data.pageData.name}" class="w-full h-full rounded-2xl transition-all duration-300 {isBlurred ? `blur-2xl` : ``}" />
            {#if isBlurred}
              <div class="flex flex-col absolute top-0 left-0 w-full h-full justify-center items-center">
                <p class="text-green">This asset has the NSFW tag.</p>
                <Button onclick={() => isBlurred = false}>Unhide</Button>
              </div>
            {/if}
          </div>
        </Carousel.Item>
      {/each}
    </Carousel.Content>
    {#if iconApi && data.pageData.icons.length > 1}
      <CarouselNavigator api={iconApi} />
    {/if}
  </Carousel.Root>
{/snippet}

{#snippet assetCarousel(assets: AssetPublicAPIv3[], isLoading: boolean, apiType: `author` | `related`, title = "Related Assets", ifNoFound = "No related assets found.", guessNumber = 5)}
  <div class="w-full px-2">
    <div class="flex justify-between items-center">
      <span class="text-lg font-semibold">{title}</span>
      {#if apiType === "related" && isEditing}
        <Button onclick={() => addRelatedDialog?.showDialog()}>
          <PlusIcon />
          Add Related Asset
        </Button>
      {/if}
    </div>
    {#if assets.length === 0 && !isLoading}
      <div class="flex w-full justify-center items-center">
        <span class="text-gray-500 dark:text-gray-400 w-full py-8 text-center">{ifNoFound}</span>
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
          <CarouselNavigator api={relatedApi} showOnlyOne={true} />
        {:else if apiType === "author" && authorApi}
          <CarouselNavigator api={authorApi} showOnlyOne={true} />
        {/if}
      </Carousel.Root>
    {/if}
  </div>
{/snippet}
<!-- #endregion -->

{#snippet buttons(center = mobileView.current)}
  <div class={cn("flex flex-row gap-2 flex-wrap", center ? "justify-center" : "justify-start")}>
    {#if !isEditing}
      <Button variant="default" href={getAssetUrl(`unknown`)} disabled>
        <DownloadIcon />
        Download
      </Button>
      <Button variant="outline" href="" disabled>
        <CloudDownloadIcon />
        OneClick Install
      </Button>
      {#if allowedToReport}
        <Button variant="destructive" href="/assets/{data.pageData.id}/report" disabled>
          <MegaphoneIcon />
          Report
        </Button>
      {/if}
      {#if data.user && data.user.roles.includes(UserPermissions.Approve_Assets)}
        <Button
          variant="secondary"
          onclick={() => {
            approvalDialog?.showDialog(data.pageData.id, data.pageData.name);
          }}>
          <BadgeAlert />
          Approval Dialog
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
        Submit Changes</Button>
        <Button
          variant="secondary"
          onclick={() => {
            isEditing = !isEditing;
            editName = data.pageData.name;
            editDescription = data.pageData.description || "";
            editTags = (data.pageData.tags as Tags[]) || [];
          }}>
          Discard Changes
        </Button>
      {:else}
        <Button
          variant="secondary"
          onclick={() => {
            isEditing = !isEditing;
          }}>
          <Edit />
          Edit
        </Button>
      {/if}
    {/if}
  </div>
{/snippet}

<!-- #region Editable Fields -->
{#snippet title(center = mobileView.current)}
  <div class={cn("mb-2 w-full text-center", center ? "text-center" : "text-left")}>
    {#if isEditing}
      <div class="flex flex-col w-full">
        <Input aria-invalid={!zAssetName.success} type="text" bind:value={editName} placeholder="Asset Name" class="w-full mb-2" />
        {#if !zAssetName.success}
          <span class="text-sm text-red-500 mt-1">{fromZodError(zAssetName.error)}</span>
        {/if}
      </div>
    {:else}
      <span class="text-3xl font-bold">{data.pageData.name}</span>
    {/if}
  </div>
{/snippet}

{#snippet description()}
  {#if isEditing}
    <Textarea bind:value={editDescription} placeholder="Asset Description" class="w-full mb-2 min-h-64" />
  {:else}
    <span class="text-lg text-gray-500 dark:text-gray-400 whitespace-pre-line text-wrap wrap-anywhere">{data.pageData.description || "No description available."}</span>
  {/if}
{/snippet}
<!-- #endregion -->

<div class="flex flex-col items-center m-auto max-w-6xl p-4 bg-background rounded-2xl">
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
        {@render assetCarousel(relatedAssets, isRelatedLoading, `related`, "Related Assets:", "No related assets found.")}
        <Separator class="my-4 w-full" />
        {@render assetCarousel(authorAssets, isAuthorLoading, `author`, `Other assets by ${data.pageData.uploader?.displayName}:`, "No other assets found.")}
        {#if mobileView.current}
          {@render dataTable()}
        {/if}
      </div>
    </div>
  </div>
</div>

<ApprovalPopup bind:this={approvalDialog} />
<LinkAssetDialog bind:this={addRelatedDialog} />
<TagPicker bind:open={openTagPicker} bind:selectedTags={editTags} type={data.pageData.type} />
