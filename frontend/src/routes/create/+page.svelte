<script lang="ts">
  import { AssetFileFormat, Tags } from "$lib/scripts/api/DBTypes";
  import LicenseSelector from "$lib/components/forms/LicenseSelector.svelte";
  import Button, { buttonVariants } from "$shadcn/components/ui/button/button.svelte";
  import Input from "$shadcn/components/ui/input/input.svelte";
  import Label from "$shadcn/components/ui/label/label.svelte";
  import Textarea from "$shadcn/components/ui/textarea/textarea.svelte";
  import TagPicker from "$lib/components/forms/TagPickerDialog.svelte";
  import { DivideCircleIcon, TagIcon } from "@lucide/svelte";
  import TagBadge from "$lib/components/assets/TagBadge.svelte";
  import TypeSelector from "$lib/components/forms/TypeSelector.svelte";
  import { parseErrorMessage, trpc } from "$lib/scripts/utils/api";
  import { redirect } from "@sveltejs/kit";
  import { toast } from "svelte-sonner";
  import { zAsset } from "$lib/scripts/api/validator";

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
      toast.error("Please select an asset file to upload.");
      return;
    }
    formData.append("asset", asset[0]);
    if (thumbnails && thumbnails.length > 0) {
      for (let i = 0; i < thumbnails.length; i++) {
        formData.append(`icon_${i+1}`, thumbnails[i]);
      }
    } else {
      toast.error("Please select a thumbnail image to upload.");
      return;
    }

    // needs to be awaited since redirect is an error throw
    let newAsset = trpc.uploadAssetV3.part1.mutate(formData).catch((err) => {
      toast.error(`Failed to submit asset: ${parseErrorMessage(err)}`);
      console.error(err);
    });
    Promise.resolve(newAsset).then((asset) => {
      if (asset) {
        toast.success("Asset submitted successfully!");
        window.location.href = `/assets/${asset.id}`; // redirect to new asset page
      }
    });
  }
</script>

<div class="flex flex-col text-center w-full p-4">
  <h1 class="text-2xl font-bold mb-4">Create Asset</h1>
  <p class="text-base mb-4">Please fill out the form below to create a new asset.</p>
</div>

<div class="flex flex-row flex-wrap justify-center p-4 gap-4">
  <div class="flex flex-col w-full max-w-md">
    <!-- left side -->
    <div class="flex flex-col justify-center w-full max-w-md p-4 gap-2 bg-card rounded-lg shadow-md">
      <span>
        <Label class="p-1 pb-2" for="type">Type</Label>
        <TypeSelector bind:value={type} id="type" class="w-full" />
      </span>
      <span>
        <Label class="p-1 pb-2" for="name">Name</Label>
        <Input bind:value={name} aria-invalid={!zAsset.shape.name.safeParse(name).success} id="name" />
      </span>
      <span>
        <Label class="p-1 pb-2" for="description">Description</Label>
        <Textarea class="min-h-32" bind:value={description} aria-invalid={!zAsset.shape.description.safeParse(description).success} id="description" />
      </span>
      <span>
        <Label class="p-1 pb-2" for="license">License</Label>
        <LicenseSelector bind:value={license} id="license" />
      </span>
      {#if license === "custom"}
        <span>
          <Label class="p-1 pb-2" for="custom-license">Custom License</Label>
          <Input bind:value={customLicense} aria-invalid={!zAsset.shape.licenseUrl.safeParse(customLicense).success} id="custom-license" />
        </span>
      {/if}
      <span>
        <Label class="p-1 pb-2" for="tags">Tags</Label>
        <div class="flex flex-row items-center justify-between">
          <div class="flex flex-wrap gap-2 pl-1">
            {#each tags as tag}
              <TagBadge {tag} />
            {:else}
              <span class="text-muted-foreground">No tags selected.</span>
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
      <p>Thumbnails:</p>
      <ul class="list-disc ml-6">
        <li>Must have a 1x1 aspect ratio.</li>
        <li>Must be tasteful and appropiate.</li>
        <li>Thumbnails must be at least 512 by 512 pixels.</li>
        <li>Can be of the image types .png, .jpeg, .webp, and .gif.</li>
      </ul>
    </div>
    <div class="flex flex-col justify-center w-full max-w-md p-4 bg-card rounded-lg shadow-md mt-4">
      <!-- value is the first file in the files array -->
      <Label class="p-1 pb-2" for="thumbnail">Thumbnail</Label>
      <Input id="thumbnail" type="file" bind:files={thumbnails} accept=".png,.jpeg,.webp,.gif" multiple />
      <p class="text-sm text-muted-foreground mt-2 pl-1">Please ensure your thumbnail meets the requirements above.</p>
      <span class="h-4"></span>
      <Label class="p-1 pb-2" for="zip">Asset</Label>
      <Input
        bind:files={asset}
        class=""
        type="file"
        id="asset"
        accept={Object.values(AssetFileFormat)
          .map((f) => f.split(`_`)[1])
          .join(`,.`)} />
      <p class="text-sm text-muted-foreground mt-2 pl-1">Please ensure that you have the rights to upload this asset to ModelSaber.</p>
    </div>
    <div class="flex flex-col justify-center w-full max-w-md p-4 bg-card rounded-lg shadow-md mt-4">
      <Button onclick={submitAsset} class="w-full">Submit</Button>
    </div>
  </div>
</div>

{#key type}
  <TagPicker type={type} bind:selectedTags={tags} bind:open={openTagPicker} />
{/key}