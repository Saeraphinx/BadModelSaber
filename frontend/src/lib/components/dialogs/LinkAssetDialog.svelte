<script lang="ts">
  import { env } from "$env/dynamic/public";
  import { m } from "$lib/paraglide/messages";
  import { LinkedAssetLinkType } from "$lib/scripts/from_backend/DBExtras";
  import { parseErrorMessage, trpc } from "$lib/scripts/utils/api";
  import { Button } from "$shadcn/components/ui/button";
  import * as Dialog from "$shadcn/components/ui/dialog";
  import Input from "$shadcn/components/ui/input/input.svelte";
  import { Label } from "$shadcn/components/ui/label";
  import * as Select from "$shadcn/components/ui/select";
  import { LoaderIcon } from "@lucide/svelte";
  import { toast } from "svelte-sonner";

  
  let assetId: number | undefined = $state();
  let visible = $state<boolean>(false);
  let showLoading = $state<boolean>(false);
  let idToLinkTo = $state<string>("");
  let selectedLinkType = $state<LinkedAssetLinkType>(LinkedAssetLinkType.Alternate);
  
  let linkTypes = [
    { value: LinkedAssetLinkType.AltFormat, label: m["dialogs.linkAssetDialog.linkTypes.altFormat.title"](), description: m["dialogs.linkAssetDialog.linkTypes.altFormat.description"]() },
    { value: LinkedAssetLinkType.Alternate, label: m["dialogs.linkAssetDialog.linkTypes.altDesign.title"](), description: m["dialogs.linkAssetDialog.linkTypes.altDesign.description"]() },
    { value: LinkedAssetLinkType.Newer, label: m["dialogs.linkAssetDialog.linkTypes.newerVersion.title"](), description: m["dialogs.linkAssetDialog.linkTypes.newerVersion.description"]() },
    { value: LinkedAssetLinkType.Older, label: m["dialogs.linkAssetDialog.linkTypes.olderVersion.title"](), description: m["dialogs.linkAssetDialog.linkTypes.olderVersion.description"]() }
  ]
  let selectedLinkTypeObj = $derived.by(() => {
    let found = linkTypes.find(lt => lt.value === selectedLinkType);
    return found ? found : { value: undefined, label: m["dialogs.linkAssetDialog.selectLinkType"](), description: `` };
  });
  
  export function showDialog(id: number) {
    assetId = id;
    visible = true;
  }

  function handleSubmit() {
    console.log("Link Asset Submitted");
    let id = -1;
    if (!assetId || assetId <= 0) {
      console.error("Invalid asset ID, this is very bad:", assetId);
      toast.error(m["toasts.error.generic"]());
      return;
    }
    if (idToLinkTo.startsWith("https://") || idToLinkTo.startsWith("http://")) {
      let parts = idToLinkTo.split("/");
      id = parseInt(parts[parts.length - 1], 10);
    } else {
      id = parseInt(idToLinkTo, 10);
    }
    if (isNaN(id) || id <= 0) {
      toast.error(m["toasts.error.validationTitle"](), { description: m["toasts.error.validation.invalidUrl"]() });
      return;
    }
    showLoading = true;
    trpc.internal.updateThings.linkAsset.mutate({
      assetId: assetId,
      type: selectedLinkType,
      linkToId: id
    }).then((response) => {
      toast.success(m["toasts.success.assetLink"]());
      showLoading = false;
      visible = false;
    }).catch((err) => {
      toast.error(m["toasts.error.generic"](), {description: `${parseErrorMessage(err)}` });
      showLoading = false;
    });
  }
</script>

<Dialog.Root bind:open={visible}>
  <Dialog.Content class="sm:max-w-[425px]">
    <Dialog.Header>
      <Dialog.Title>{m["dialogs.linkAssetDialog.title"]()}</Dialog.Title>
      <Dialog.Description>{m["dialogs.linkAssetDialog.description"]()}</Dialog.Description>
    </Dialog.Header>
    <div class="flex flex-col">
      <Select.Root type="single" bind:value={selectedLinkType}>
        <Label class="mb-2">{m["dialogs.linkAssetDialog.linkType"]()}</Label>
        <Select.Trigger class="w-full">{selectedLinkTypeObj.label}</Select.Trigger>
        <Select.Content>
          {#each linkTypes as item}
            <Select.Item value={item.value}>{item.label}</Select.Item>
          {/each}
        </Select.Content>
      </Select.Root>
      <span class="text-xs text-secondary-foreground/50 mt-1 mx-1">{selectedLinkTypeObj.description}</span>
      <div class="flex flex-col mt-4">
        <Label class="mb-2">{m["dialogs.linkAssetDialog.assetUrl"]()}</Label>
        <Input bind:value={idToLinkTo} type="text" placeholder="{env.PUBLIC_BASE_URL}/asset/1234" class="w-full" />
      </div>
    </div>
    <Dialog.Footer>
      <div class="flex justify-end items-center">
        {#if showLoading}
          <LoaderIcon class="animate-spin mr-2" />
        {/if}
        <Button type="submit" disabled={showLoading} onclick={handleSubmit}>{m["dialogs.saveChanges"]()}</Button>
      </div>
    </Dialog.Footer>
  </Dialog.Content>
</Dialog.Root>
