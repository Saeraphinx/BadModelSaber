<script lang="ts">
  import { AssetFileFormat, Tags } from "$lib/scripts/api/DBTypes";
  import LicenseSelector from "$lib/components/forms/LicenseSelector.svelte";
  import Button, { buttonVariants } from "$shadcn/components/ui/button/button.svelte";
  import Input from "$shadcn/components/ui/input/input.svelte";
  import Label from "$shadcn/components/ui/label/label.svelte";
  import Textarea from "$shadcn/components/ui/textarea/textarea.svelte";
  import TagPicker from "$lib/components/forms/TagPicker.svelte";
  import { DivideCircleIcon, TagIcon } from "@lucide/svelte";
  import TagBadge from "$lib/components/assets/TagBadge.svelte";
  import TypeSelector from "$lib/components/forms/TypeSelector.svelte";

  let type = $state(AssetFileFormat.Note_Bloq);
  let name = $state("");
  let description = $state("");
  let license = $state("");
  let customLicense = $state("");
  let tags: Tags[] = $state([]);
  let credits = $state("");
  let thumbnail: FileList | undefined = $state(undefined);
  let asset: File | undefined = $state(undefined);

  let openTagPicker = $state(false);
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
        <Input bind:value={name} id="name" />
      </span>
      <span>
        <Label class="p-1 pb-2" for="description">Description</Label>
        <Textarea class="min-h-32" bind:value={description} id="description" />
      </span>
      <span>
        <Label class="p-1 pb-2" for="license">License</Label>
        <LicenseSelector bind:value={license} id="license" />
      </span>
      {#if license === "custom"}
        <span>
          <Label class="p-1 pb-2" for="custom-license">Custom License</Label>
          <Input bind:value={customLicense} id="custom-license" />
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
      <Input id="thumbnail" type="file" files={thumbnail} accept=".png,.jpeg,.webp,.gif" multiple />
      <p class="text-sm text-muted-foreground mt-2 pl-1">Please ensure your thumbnail meets the requirements above.</p>
      <span class="h-4"></span>
      <Label class="p-1 pb-2" for="zip">Asset</Label>
      <Input
        bind:value={asset}
        class=""
        type="file"
        id="asset"
        accept={Object.values(AssetFileFormat)
          .map((f) => f.split(`_`)[1])
          .join(`,.`)} />
      <p class="text-sm text-muted-foreground mt-2 pl-1">Please ensure that you have the rights to upload this asset to ModelSaber.</p>
    </div>
    <div class="flex flex-col justify-center w-full max-w-md p-4 bg-card rounded-lg shadow-md mt-4">
      <Button class="w-full">Submit</Button>
    </div>
  </div>
</div>

{#key type}
  <TagPicker type={type} bind:selectedTags={tags} bind:open={openTagPicker} />
{/key}