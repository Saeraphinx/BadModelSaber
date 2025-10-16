<script lang="ts">
  import { Status } from "$lib/scripts/api/DBTypes";
  import { fetchApiSafe } from "$lib/scripts/utils/api";
  import { Button, buttonVariants } from "$shadcn/components/ui/button/index.js";
  import * as Dialog from "$shadcn/components/ui/dialog/index.js";
  import { Input } from "$shadcn/components/ui/input/index.js";
  import { Label } from "$shadcn/components/ui/label/index.js";
  import * as RadioGroup from "$shadcn/components/ui/radio-group";
  import { toast } from "svelte-sonner";

 let statuses = Object.values(Status).map((status) => ({
    value: status,
    label: status,
  }));

  let selectedStatus = $state(statuses[0].value);
  let reason = $state("");

  let name = $state<string>("");
  let id = $state<number>(0);
  let visible = $state<boolean>(false);

  export function showDialog(p_id: number, p_name: string) {
    id = p_id;
    name = p_name;
    visible = true;
  }

  function handleSubmit() {
    console.log(`Updating asset ${id} (${name}) to status ${selectedStatus} with reason: ${reason}`);
    let res = fetchApiSafe(`/approvals/assets/${id}`, {
      method: 'POST',
      credentials: 'include',
      body: JSON.stringify({
        status: selectedStatus,
        reason: reason,
      }),
    }).then((res) => {
      if (!res.isError) {
        console.log(`Successfully updated asset ${id} (${name}) to status ${selectedStatus}`);
        toast.success(`Successfully updated asset ${name} to ${selectedStatus}`, {
          description: "The asset status has been updated successfully. Reload the page to see changes.",
          dismissable: false,
          action: {
            label: "Reload",
            onClick: () => window.location.reload(),
          },
        });
        visible = false;
      } else {
        console.error(`Failed to update asset ${id} (${name}):`, res.message);
        toast.error(`Failed to update asset ${name}`, {
          description: res.message || "An error occurred while updating the asset status.",
          dismissable: true,
          duration: 30000
        });
      }
    }).catch((err) => {
      console.error(`Error updating asset ${id} (${name}):`, err);
      toast.error(`Error updating asset ${name}`, {
        description: "An unexpected error occurred while updating the asset status.",
        dismissable: true,
        duration: 30000
      });
    });
  }
</script>

<Dialog.Root bind:open={visible} >
  <Dialog.Content class="sm:max-w-[425px]">
    <Dialog.Header>
      <Dialog.Title>Update Status for {name}</Dialog.Title>
      <Dialog.Description>Make changes to your profile here. Click save when you're done.</Dialog.Description>
    </Dialog.Header>
    <div class="flex flex-row">
      <RadioGroup.Root>
        {#each statuses as status}
          <div class="flex items-center space-x-2 capitalize">
            <RadioGroup.Item value={status.value} id={status.value} />
            <Label for={status.value}>{status.label}</Label>
          </div>
        {/each}
      </RadioGroup.Root>
      <div class="flex flex-col w-full ml-4">
        <Input
          type="text"
          placeholder="Reason for change"
          class="w-full"
          bind:value={reason}
        />
        <p class="text-sm text-muted-foreground mt-1">This will be visible to the user.</p>
      </div>
    </div>
    <Dialog.Footer>
      <Button type="submit" onclick={handleSubmit}>Save changes</Button>
    </Dialog.Footer>
  </Dialog.Content>
</Dialog.Root>
