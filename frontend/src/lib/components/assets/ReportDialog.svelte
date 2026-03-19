<script lang="ts">
  import { m } from "$lib/paraglide/messages";
  import { trpc } from "$lib/scripts/utils/api";
  import { Button } from "$shadcn/components/ui/button";
  import * as Dialog from "$shadcn/components/ui/dialog";
  import Input from "$shadcn/components/ui/input/input.svelte";
  import { Textarea } from "$shadcn/components/ui/textarea";
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
    let res = trpc.internal.requests.reportAsset.mutate({
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
      <Dialog.Title>{m["dialogs.reportDialog.title"]({ name })}</Dialog.Title>
      <Dialog.Description>{m["dialogs.reportDialog.description"]()}</Dialog.Description>
    </Dialog.Header>
    <div class="flex flex-row">
      <Textarea bind:value={reason} placeholder={m["dialogs.reportDialog.reasonPlaceholder"]()} />
    </div>
    <Dialog.Footer>
      <Button variant="ghost" onclick={() => (visible = false)}>{m["dialogs.cancel"]()}</Button>
      <Button type="submit" onclick={handleSubmit}>{m["dialogs.submit"]()}</Button>
    </Dialog.Footer>
  </Dialog.Content>
</Dialog.Root>
