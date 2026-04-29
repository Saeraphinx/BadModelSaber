<script lang="ts">
  import { AssetFileFormat, Tags } from "$lib/scripts/api/DBTypes";
  import LicenseSelector from "$lib/components/forms/LicenseSelector.svelte";
  import Button from "$shadcn/components/ui/button/button.svelte";
  import Input from "$shadcn/components/ui/input/input.svelte";
  import Label from "$shadcn/components/ui/label/label.svelte";
  import Textarea from "$shadcn/components/ui/textarea/textarea.svelte";
  import TagPicker from "$lib/components/dialogs/TagPickerDialog.svelte";
  import { TagIcon } from "@lucide/svelte";
  import TagBadge from "$lib/components/assets/TagBadge.svelte";
  import TypeSelector from "$lib/components/forms/TypeSelector.svelte";
  import { parseErrorMessage, trpc } from "$lib/scripts/utils/api";
  import { toast } from "svelte-sonner";
  import { zAsset } from "$lib/scripts/api/validators";
  import { m } from "$lib/paraglide/messages";

  let type = $state(AssetFileFormat.Note_Bloq);
  let name = $state("");
  let description = $state("");
  let license = $state("");
  let customLicense = $state("");
  let tags: Tags[] = $state([]);
  let credits = $state("");
  let thumbnails: FileList | undefined = $state(undefined);
  let asset: FileList | undefined = $state(undefined);

  let openTagPicker = $state(false);

  function submitAsset() {
    let formData = new FormData();
    formData.append("data", JSON.stringify({
      type,
      name,
      description,
      license: license,
      licenseUrl: !customLicense || customLicense.length == 0 ? null : customLicense,
      sourceUrl: null,
      tags,
      credits,
    }));
    console.log("Submitting asset with data:", {
      type,
      name,
      description,
      license: license ?? "custom",
      licenseUrl: !customLicense || customLicense.length == 0 ? null : customLicense,
      tags,
      credits,
      asset,
      thumbnails,
    });
    if (!asset || !asset[0]) {
      toast.error(m["toasts.error.validationTitle"](), { description: m["toasts.error.validation.invalidFile"]() });
      console.error("No asset file selected.");
      return;
    }
    formData.append("asset", asset[0]);
    if (thumbnails && thumbnails.length > 0) {
      for (let i = 0; i < thumbnails.length; i++) {
        formData.append(`icon_${i+1}`, thumbnails[i]);
      }
    } else {
      toast.error(m["toasts.error.validationTitle"](), { description: m["toasts.error.validation.invalidFile"]() });
      console.error("No thumbnail file(s) selected.");
      return;
    }

    // needs to be awaited since redirect is an error throw
    let newAsset = trpc.v3.upload.assetUpload.mutate(formData).then((asset) => {
      if (asset) {
        toast.success(m["toasts.success.submit"]());
        window.location.href = `/assets/${asset.id}`; // redirect to new asset page
      }
    }).catch((err) => {
      toast.error(m["toasts.error.generic"](), { description: parseErrorMessage(err) });
      console.error(err);
    });
  }
</script>

<div class="flex flex-col text-center w-full p-4">
  <h1 class="text-2xl font-bold mb-4">{m["assets.upload.createAsset"]()}</h1>
  <p class="text-base mb-4">{m["assets.upload.createAssetSubtitle"]()}</p>
</div>

<div class="flex flex-row flex-wrap justify-center p-4 gap-4">
  <div class="flex flex-col w-full max-w-md">
    <!-- left side -->
    <div class="flex flex-col justify-center w-full max-w-md p-4 gap-2 bg-card rounded-lg shadow-md">
      <span>
        <Label class="p-1 pb-2" for="type">{m["assets.dataTable.type"]()}</Label>
        <TypeSelector bind:value={type} id="type" class="w-full" />
      </span>
      <span>
        <Label class="p-1 pb-2" for="name">{m["assets.dataTable.name"]()}</Label>
        <Input bind:value={name} aria-invalid={!zAsset.shape.name.safeParse(name).success} id="name" />
      </span>
      <span>
        <Label class="p-1 pb-2" for="description">{m["assets.dataTable.description"]()}</Label>
        <Textarea class="min-h-32" bind:value={description} aria-invalid={!zAsset.shape.description.safeParse(description).success} id="description" />
      </span>
      <span>
        <Label class="p-1 pb-2" for="license">{m["assets.dataTable.license"]()}</Label>
        <LicenseSelector bind:value={license} id="license" />
      </span>
      {#if license === "custom"}
        <span>
          <Label class="p-1 pb-2" for="custom-license">{m["assets.dataTable.customLicense"]()}</Label>
          <Input bind:value={customLicense} aria-invalid={!zAsset.shape.licenseUrl.safeParse(customLicense).success} id="custom-license" />
        </span>
      {/if}
      <span>
        <Label class="p-1 pb-2" for="tags">{m["assets.dataTable.tags"]()}</Label>
        <div class="flex flex-row items-center justify-between">
          <div class="flex flex-wrap gap-2 pl-1">
            {#each tags as tag}
              <TagBadge {tag} />
            {:else}
              <span class="text-muted-foreground">{m["assets.dataTable.noTags"]()}</span>
            {/each}
          </div>
          <Button variant="secondary" onclick={() => openTagPicker = true}>
            Select Tags
            <TagIcon />
          </Button>
        </div>
      </span>
    </div>
  </div>
  <div class="flex flex-col w-full max-w-md">
    <!-- right side -->
    <div class="flex flex-col justify-center w-full max-w-md p-4 bg-card rounded-lg shadow-md">
      <p>{m["assets.upload.thumbnailRuleListHeader"]()}</p>
      <ul class="list-disc ml-6">
        <li>{m["assets.upload.thumbnailRuleList1"]()}</li>
        <li>{m["assets.upload.thumbnailRuleList2"]()}</li>
        <li>{m["assets.upload.thumbnailRuleList3"]()}</li>
        <li>{m["assets.upload.thumbnailRuleList4"]()}</li>
      </ul>
    </div>
    <div class="flex flex-col justify-center w-full max-w-md p-4 bg-card rounded-lg shadow-md mt-4">
      <!-- value is the first file in the files array -->
      <Label class="p-1 pb-2" for="thumbnail">{m["assets.upload.thumbnail"]()}</Label>
      <Input id="thumbnail" type="file" bind:files={thumbnails} accept=".png,.jpeg,.webp,.gif" multiple />
      <p class="text-sm text-muted-foreground mt-2 pl-1">{m["assets.upload.thumbnailFooter"]()}</p>
      <span class="h-4"></span>
      <Label class="p-1 pb-2" for="zip">{m["assets.asset"]()}</Label>
      <Input
        bind:files={asset}
        class=""
        type="file"
        id="asset"
        accept={Object.values(AssetFileFormat)
          .map((f) => f.split(`_`)[1])
          .join(`,.`)} />
      <p class="text-sm text-muted-foreground mt-2 pl-1">{m["assets.upload.ensureRights"]()}</p>
    </div>
    <div class="flex flex-col justify-center w-full max-w-md p-4 bg-card rounded-lg shadow-md mt-4">
      <Button onclick={submitAsset} class="w-full">{m["dialogs.submit"]()}</Button>
    </div>
  </div>
</div>

{#key type}
  <TagPicker type={type} bind:selectedTags={tags} bind:open={openTagPicker} />
{/key}