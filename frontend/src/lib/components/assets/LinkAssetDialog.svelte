<script lang="ts">
  import { env } from "$env/dynamic/public";
  import { LinkedAssetLinkType } from "$lib/scripts/api/DBTypes";
  import { parseErrorMessage, trpc } from "$lib/scripts/utils/api";
  import { Button } from "$shadcn/components/ui/button";
  import * as Dialog from "$shadcn/components/ui/dialog";
  import * as RadioGroup from "$shadcn/components/ui/dropdown-menu";
  import Input from "$shadcn/components/ui/input/input.svelte";
  import { Label } from "$shadcn/components/ui/label";
  import * as Select from "$shadcn/components/ui/select";
  import { LoaderCircleIcon, LoaderIcon } from "@lucide/svelte";
  import { toast } from "svelte-sonner";

  
  let assetId: number | undefined = $state();
  let visible = $state<boolean>(false);
  let showLoading = $state<boolean>(false);
  let idToLinkTo = $state<string>("");
  let selectedLinkType = $state<LinkedAssetLinkType>(LinkedAssetLinkType.Alternate);
  
  let linkTypes = [
    { value: LinkedAssetLinkType.AltFormat, label: "Alternate Format", description: `Same asset in a different file format (e.g. a saber in the .saber and .wacker formats)` },
    { value: LinkedAssetLinkType.Alternate, label: "Alternate Design", description: `A different design or version of the same asset (e.g. a saber with a different color scheme or model)` },
    { value: LinkedAssetLinkType.Newer, label: "Newer Version", description: `A more recent version of the asset, typically with improvements or updates` },
    { value: LinkedAssetLinkType.Older, label: "Older Version", description: `A previous version of of the asset released before the current one` },
  ]
  let selectedLinkTypeObj = $derived.by(() => {
    let found = linkTypes.find(lt => lt.value === selectedLinkType);
    return found ? found : { value: undefined, label: "Select Link Type", description: `` };
  });
  
  export function showDialog(id: number) {
    assetId = id;
    visible = true;
  }

  function handleSubmit() {
    console.log("Link Asset Submitted");
    let id = -1;
    if (!assetId || assetId <= 0) {
      toast.error("No asset specified to link from.", { description: `Please report this message to the site administrators.` });
      return;
    }
    if (idToLinkTo.startsWith("https://") || idToLinkTo.startsWith("http://")) {
      let parts = idToLinkTo.split("/");
      id = parseInt(parts[parts.length - 1], 10);
    } else {
      id = parseInt(idToLinkTo, 10);
    }
    if (isNaN(id) || id <= 0) {
      toast.error("Please enter a valid asset URL or ID to link to.");
      return;
    }
    showLoading = true;
    trpc.UpdateAssetRouter.linkAsset.mutate({
      assetId: assetId,
      type: selectedLinkType,
      linkToId: id
    }).then(() => {
      toast.success("Asset linked successfully.");
      showLoading = false;
      visible = false;
    }).catch((err) => {
      toast.error("Failed to link asset.", { description: `${parseErrorMessage(err)}` });
      showLoading = false;
    });
  }
</script>

<Dialog.Root bind:open={visible}>
  <Dialog.Content class="sm:max-w-[425px]">
    <Dialog.Header>
      <Dialog.Title>Add a Related Asset</Dialog.Title>
      <Dialog.Description></Dialog.Description>
    </Dialog.Header>
    <div class="flex flex-col">
      <Select.Root type="single" bind:value={selectedLinkType}>
        <Label class="mb-2">Link Type</Label>
        <Select.Trigger class="w-full">{selectedLinkTypeObj.label}</Select.Trigger>
        <Select.Content>
          {#each linkTypes as item}
            <Select.Item value={item.value}>{item.label}</Select.Item>
          {/each}
        </Select.Content>
      </Select.Root>
      <span class="text-xs text-secondary-foreground/50 mt-1 mx-1">{selectedLinkTypeObj.description}</span>
      <div class="flex flex-col mt-4">
        <Label class="mb-2">Asset URL</Label>
        <Input bind:value={idToLinkTo} type="text" placeholder="{env.PUBLIC_BASE_URL}/asset/1234" class="w-full" />
      </div>
    </div>
    <Dialog.Footer>
      <div class="flex justify-end items-center">
        {#if showLoading}
          <LoaderIcon class="animate-spin mr-2" />
        {/if}
        <Button type="submit" disabled={showLoading} onclick={handleSubmit}>Save changes</Button>
      </div>
    </Dialog.Footer>
  </Dialog.Content>
</Dialog.Root>
