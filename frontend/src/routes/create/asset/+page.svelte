<script lang="ts">
  import { AssetFileFormat, AssetTypesWithRenderingMethod, RenderingModes, Tags } from "$lib/scripts/from_backend/DBExtras";
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
  import { zAsset } from "$lib/scripts/from_backend/validators";
  import { i18n } from "$lib/scripts/i18n";

  const { t } = i18n();
  import * as RadioGroup from "../../../lib/shadcn/components/ui/radio-group";
  import { getRenderingMethodString, getRenderingMethodSupportedGV } from "$lib/scripts/utils/stylizer";
  import { onMount } from "svelte";
  import { goto } from "$app/navigation";

  let type = $state(AssetFileFormat.Note_Bloq);
  let renderingMethod: string = $state(``);
  let name = $state("");
  let description = $state("");
  let license = $state("");
  let customLicense = $state("");
  let tags: Tags[] = $state([]);
  let credits = $state("");
  let thumbnails: FileList | undefined = $state(undefined);
  let asset: FileList | undefined = $state(undefined);

  let openTagPicker = $state(false);

  let isAbleToSubmit: boolean = $derived.by(() => {
    return Boolean(
      zAsset.shape.name.safeParse(name).success &&
      zAsset.shape.description.safeParse(description).success &&
      zAsset.shape.licenseUrl.safeParse(customLicense).success &&
      !!asset &&
      asset.length > 0 &&
      !!thumbnails &&
      thumbnails.length > 0 &&
      (license !== "custom" || customLicense.length > 0) &&
      (!AssetTypesWithRenderingMethod.includes(type) || renderingMethod.length > 0)
    );
  });

  async function submitAsset() {
    let formData = new FormData();
    formData.append(
      "data",
      JSON.stringify({
        type,
        name,
        description,
        license: license,
        licenseUrl: !customLicense || customLicense.length == 0 ? null : customLicense,
        sourceUrl: null,
        tags,
        credits,
        renderingMethod: renderingMethod && AssetTypesWithRenderingMethod.includes(type) ? renderingMethod : null,
      }),
    );
    console.log("Submitting asset with data:", formData.get("data"));
    if (!asset || !asset[0]) {
      toast.error(t(`toasts.error.validationTitle`), { description: t(`toasts.error.validation.invalidFile`) });
      console.error("No asset file selected.");
      return;
    }
    formData.append("asset", asset[0]);
    if (thumbnails && thumbnails.length > 0) {
      for (let i = 0; i < thumbnails.length; i++) {
        formData.append(`icon_${i + 1}`, thumbnails[i]);
      }
    } else {
      toast.error(t(`toasts.error.validationTitle`), { description: t(`toasts.error.validation.invalidFile`) });
      console.error("No thumbnail file(s) selected.");
      return;
    }

    // needs to be awaited since redirect is an error throw
    let newAsset = await trpc.v3.upload.assetUpload
      .mutate(formData)
      .then((asset) => {
        if (asset) {
          localStorage.removeItem(`createAssetData`);
          toast.success(t(`toasts.success.submit`));
          return asset;
        }
      })
      .catch((err) => {
        toast.error(t(`toasts.error.generic`), { description: parseErrorMessage(err) });
        console.error(err);
      });

    if (newAsset) {
      goto(`/assets/${newAsset.id}`);
    }
  }

  function saveDataToLocalStorage() {
    localStorage.setItem(`createAssetData`, JSON.stringify({ 
      name, 
      type,
      description,
      license,
      customLicense,
      tags,
      credits,
      renderingMethod,
    }));
  }
  onMount(() => {
    // on load, try to load saved data from local storage
    const savedDataString = localStorage.getItem(`createAssetData`);
    if (savedDataString) {
      const savedData = JSON.parse(savedDataString);
      name = savedData.name || "";
      type = savedData.type || AssetFileFormat.Note_Bloq;
      description = savedData.description || "";
      license = savedData.license || "";
      customLicense = savedData.customLicense || "";
      tags = savedData.tags || [];
      credits = savedData.credits || "";
      renderingMethod = savedData.renderingMethod || "";
    }
  });
  $effect(() => {
    tags; renderingMethod; //oninput doesn't grab these
    saveDataToLocalStorage();
  });
</script>

<div class="flex flex-col text-center w-full p-4">
  <h1 class="text-2xl font-bold mb-4">{t(`assets.upload.createAsset`)}</h1>
  <p class="text-base mb-4">{t(`assets.upload.createAssetSubtitle`)}</p>
</div>

<div class="flex flex-row flex-wrap justify-center p-4 gap-4">
  <div class="flex flex-col w-full max-w-xl">
    <!-- left side -->
    <div class="flex flex-col justify-center w-full max-w-xl p-4 gap-2 bg-card rounded-lg shadow-md" oninput={saveDataToLocalStorage}>
      <span>
        <Label class="p-1 pb-2" for="name">{t(`common.dataTable.name`)}</Label>
        <Input bind:value={name} aria-invalid={!zAsset.shape.name.safeParse(name).success} id="name" />
      </span>
      <span>
        <Label class="p-1 pb-2" for="type">{t(`common.dataTable.type`)}</Label>
        <TypeSelector bind:value={type} id="type" class="w-full" />
      </span>
      {#if AssetTypesWithRenderingMethod.includes(type)}
        <span>
          <Label class="p-1 pb-2" for="renderingMethod">{t(`common.dataTable.renderingMethod`)}</Label>
          <RadioGroup.Root bind:value={renderingMethod} class="flex flex-row flex-wrap">
            {#each Object.entries(RenderingModes) as mode}
              {#if mode[1] !== RenderingModes.Unknown}
                <div class="flex items-center space-x-2">
                  <RadioGroup.Item value={mode[1]} id={mode[1]} />
                  <span class="flex flex-col">
                    <Label for={mode[1]}>
                      {getRenderingMethodString(t, mode[1])}
                    </Label>
                    <p class="text-xs text-gray-400">For {getRenderingMethodSupportedGV(mode[1])}</p>
                  </span>
                </div>
              {/if}
            {/each}
          </RadioGroup.Root>
        </span>
      {/if}
      <span>
        <Label class="p-1 pb-2" for="description">{t(`common.dataTable.description`)}</Label>
        <Textarea class="min-h-32" bind:value={description} aria-invalid={!zAsset.shape.description.safeParse(description).success} id="description" />
      </span>
      <span>
        <Label class="p-1 pb-2" for="license">{t(`common.dataTable.license`)}</Label>
        <LicenseSelector bind:value={license} id="license" />
      </span>
      {#if license === "custom"}
        <span>
          <Label class="p-1 pb-2" for="custom-license">{t(`common.dataTable.customLicense`)}</Label>
          <Input bind:value={customLicense} aria-invalid={!zAsset.shape.licenseUrl.safeParse(customLicense).success} id="custom-license" />
        </span>
      {/if}
      <span>
        <Label class="p-1 pb-2" for="tags">{t(`common.dataTable.tags`)}</Label>
        <div class="flex flex-row items-center justify-between">
          <div class="flex flex-wrap gap-2 pl-1">
            {#each tags as tag}
              <TagBadge {tag} />
            {:else}
              <span class="text-muted-foreground">{t(`common.dataTable.noTags`)}</span>
            {/each}
          </div>
          <Button variant="secondary" onclick={() => (openTagPicker = true)}>
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
      <p>{t(`assets.upload.thumbnailRuleListHeader`)}</p>
      <ul class="list-disc ml-6">
        <li>{t(`assets.upload.thumbnailRuleList1`)}</li>
        <li>{t(`assets.upload.thumbnailRuleList2`)}</li>
        <li>{t(`assets.upload.thumbnailRuleList3`)}</li>
        <li>{t(`assets.upload.thumbnailRuleList4`)}</li>
      </ul>
    </div>
    <div class="flex flex-col justify-center w-full max-w-md p-4 bg-card rounded-lg shadow-md mt-4">
      <!-- value is the first file in the files array -->
      <Label class="p-1 pb-2" for="thumbnail">{t(`assets.upload.thumbnail`)}</Label>
      <Input id="thumbnail" type="file" bind:files={thumbnails} accept=".png,.jpeg,.webp,.gif" multiple />
      <p class="text-sm text-muted-foreground mt-2 pl-1">{t(`assets.upload.thumbnailFooter`)}</p>
      <span class="h-4"></span>
      <Label class="p-1 pb-2" for="zip">{t(`assets.asset`)}</Label>
      <Input
        bind:files={asset}
        class=""
        type="file"
        id="asset"
        accept={Object.values(AssetFileFormat)
          .map((f) => f.split(`_`)[1])
          .join(`,.`)} />
      <p class="text-sm text-muted-foreground mt-2 pl-1">{t(`assets.upload.ensureRights`)}</p>
    </div>
    <div class="flex flex-col justify-center w-full max-w-md p-4 bg-card rounded-lg shadow-md mt-4">
      <Button onclick={submitAsset} disabled={!isAbleToSubmit} class="w-full">{t(`dialogs.submit`)}</Button>
    </div>
  </div>
</div>

{#key type}
  <TagPicker {type} bind:selectedTags={tags} bind:open={openTagPicker} />
{/key}
