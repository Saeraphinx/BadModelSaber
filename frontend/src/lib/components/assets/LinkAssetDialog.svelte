<script lang="ts">
  import { LinkedAssetLinkType } from "$lib/scripts/api/DBTypes";
  import { Button } from "$shadcn/components/ui/button";
  import * as Dialog from "$shadcn/components/ui/dialog";
  import * as RadioGroup from "$shadcn/components/ui/dropdown-menu";
  import Input from "$shadcn/components/ui/input/input.svelte";
  import { Label } from "$shadcn/components/ui/label";
  import * as Select from "$shadcn/components/ui/select";

  let visible = $state<boolean>(false);
  let selectedLinkType = $state<LinkedAssetLinkType>(LinkedAssetLinkType.Alternate);
  
  let linkTypes = [
    { value: LinkedAssetLinkType.AltFormat, label: "Alternate Format" },
    { value: LinkedAssetLinkType.Alternate, label: "Alternate Design" },
    { value: LinkedAssetLinkType.Newer, label: "Newer Version" },
    { value: LinkedAssetLinkType.Older, label: "Older Version" },
  ]
  let selectedLinkTypeLabel = $derived.by(() => {
    let found = linkTypes.find(lt => lt.value === selectedLinkType);
    return found ? found.label : "Select Link Type";
  });

  export function showDialog() {
    visible = true;
  }

  function handleSubmit() {
    console.log("Link Asset Submitted");
    visible = false;
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
        <Select.Trigger class="w-full">{selectedLinkTypeLabel}</Select.Trigger>
        <Select.Content>
          {#each linkTypes as item}
            <Select.Item value={item.value}>{item.label}</Select.Item>
          {/each}
        </Select.Content>
      </Select.Root>
      <div class="flex flex-col mt-4">
        <Label class="mb-2">Asset URL</Label>
        <Input type="text" placeholder="https://example.com/asset-url" class="w-full" />
      </div>
    </div>
    <Dialog.Footer>
      <Button type="submit" onclick={handleSubmit}>Save changes</Button>
    </Dialog.Footer>
  </Dialog.Content>
</Dialog.Root>
