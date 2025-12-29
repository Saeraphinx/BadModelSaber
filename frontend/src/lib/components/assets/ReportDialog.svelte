<script lang="ts">
  import { trpc } from "$lib/scripts/utils/api";
  import { Button } from "$shadcn/components/ui/button";
  import * as Dialog from "$shadcn/components/ui/dialog";
  import Input from "$shadcn/components/ui/input/input.svelte";
  import { toast } from "svelte-sonner";

  let reason = $state<string>("");
  let name = $state<string>("");
  let id = $state<number>(0);
  let visible = $state<boolean>(false);

  export function showDialog(p_id: number, p_name: string) {
    reason = "";
    id = p_id;
    name = p_name;
    visible = true;
  }

  function handleSubmit() {
    console.log(`Reporting asset ${id} with reason: ${reason}`);
    let res = trpc.RequestRouter.reportAsset.mutate({
        assetId: id,
        reason: reason,
      }).then((res) => {
        console.log(`Successfully reported asset ${id}`);
        toast.success(`Successfully reported asset`, {
          description: "The asset has been reported successfully.",
          dismissable: true,
        });
        visible = false;
      }).catch((err) => {
      console.error(`Error reporting asset ${id}:`, err);
      toast.error(`Error reporting asset`, {
        description: "An unexpected error occurred while reporting the asset.",
        dismissable: true,
        duration: 30000
      });
    });
  }
</script>

<Dialog.Root bind:open={visible}>
  <Dialog.Content class="sm:max-w-[425px]">
    <Dialog.Header>
      <Dialog.Title>Report {name}</Dialog.Title>
      <Dialog.Description>Please let us know why you are reporting this asset </Dialog.Description>
    </Dialog.Header>
    <div class="flex flex-row">
      <Input type="text" bind:value={reason} placeholder="Reason for report" />
    </div>
    <Dialog.Footer>
      <Button variant="ghost" onclick={() => (visible = false)}>Cancel</Button>
      <Button type="submit" onclick={handleSubmit}>Save changes</Button>
    </Dialog.Footer>
  </Dialog.Content>
</Dialog.Root>
