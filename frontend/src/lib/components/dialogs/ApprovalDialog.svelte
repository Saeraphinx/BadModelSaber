<script lang="ts">
  import { invalidateAll } from "$app/navigation";
  import { m } from "$lib/paraglide/messages";
  import { Status } from "$lib/scripts/from_backend/DBExtras";
  import { parseErrorMessage, trpc } from "$lib/scripts/utils/api";
  import { getStatusAvailableThings, getStatusString } from "$lib/scripts/utils/stylizer";
  import { Button } from "$shadcn/components/ui/button/index.js";
  import * as Dialog from "$shadcn/components/ui/dialog/index.js";
  import { Input } from "$shadcn/components/ui/input/index.js";
  import { Label } from "$shadcn/components/ui/label/index.js";
  import * as RadioGroup from "$shadcn/components/ui/radio-group";
  import { toast } from "svelte-sonner";
  import Switch from "../../shadcn/components/ui/switch/switch.svelte";
  import * as Select from "../../shadcn/components/ui/select";

  let statuses = Object.values(Status).map((status) => ({
    value: status,
    label: getStatusString(status),
    showFor: getStatusAvailableThings(status)
  }));

  let selectedStatus = $state(Status.Private);
  let reason = $state("");

  let presetReasons = [
    "Inappropriate content",
    "Version mismatch",
    "Causes crashes or issues with base game",
    "Minor issues reported by users",
    "Unmarked incompatibility with other mods",
    "Malformed zip file",
    "Missing or incorrect metadata",
    "Missing dependencies",
    "Removed per submitter",
  ]

  let name = $state<string>("");
  let id = $state<number>(0);
  let visible = $state<boolean>(false);
  let type = $state<`asset` | `project` | `version`>("asset");
  let autosetProject = $state<boolean>(true);

  export function showDialog(p_id: number, p_name: string, thingType: `asset` | `project` | `version`, currentStatus: Status = Status.Private) {
    reason = "";
    selectedStatus = currentStatus;
    id = p_id;
    name = p_name;
    type = thingType;
    visible = true;
    autosetProject = true;
  }

  function handleSubmit() {
    console.log(`Updating thing ${id} (${name}) to status ${selectedStatus} with reason: ${reason}`);
    let res;
    if (type === `asset`) {
      res = trpc.internal.admin.approval.setStatusAsset.mutate({
        id: id,
        status: selectedStatus as unknown as any,
        reason: reason,
      });
    } else if (type === `project`) {
      res = trpc.internal.admin.approval.setStatusProject.mutate({
        id: id,
        status: selectedStatus as unknown as any,
        reason: reason,
      });
    } else {
      res = trpc.internal.admin.approval.setStatusVersion.mutate({
        id: id,
        status: selectedStatus as unknown as any,
        reason: reason,
        autosetProject: autosetProject,
      });
    }
    res
      .then((res) => {
        console.log(`Successfully updated thing ${id} (${name}) to status ${selectedStatus}`);
        toast.success(`Successfully updated thing ${name} to ${selectedStatus}`, {
          description: "The thing status has been updated successfully.",
          dismissable: false,
        });
        visible = false;
        invalidateAll();
      })
      .catch((err) => {
        console.error(`Error updating thing ${id} (${name}):`, err);
        toast.error(m["toasts.error.save"](), {
          description: parseErrorMessage(err),
          dismissable: true,
          duration: 30000,
        });
      });
  }
</script>

<Dialog.Root bind:open={visible}>
  <Dialog.Content class="sm:max-w-[550px]">
    <Dialog.Header>
      <Dialog.Title>{m["dialogs.approvalDialog.title"]({ name })}</Dialog.Title>
      <Dialog.Description>{m["dialogs.approvalDialog.description"]({ name })}</Dialog.Description>
    </Dialog.Header>
    <div class="flex flex-row">
      <RadioGroup.Root bind:value={selectedStatus} >
        {#each statuses as status}
          {#if status.showFor.includes(type)}
            <div class="flex items-center space-x-2 capitalize">
              <RadioGroup.Item value={status.value} id={status.value} />
              <Label for={status.value}>{status.label}</Label>
            </div>
          {/if}
        {/each}
      </RadioGroup.Root>
      <div class="flex flex-col w-full ml-4">
        <Input type="text" placeholder={m["dialogs.approvalDialog.reasonPlaceholder"]()} class="w-full" bind:value={reason} />
        <p class="text-sm text-muted-foreground mt-1">{m["dialogs.approvalDialog.reasonWillBeVisible"]({ name })}</p>
        <Label class="mt-4">{m["dialogs.approvalDialog.presetReasons"]()}</Label>
        <Select.Root type="single" >
          <Select.Trigger class="w-full mt-1">
            Select a preset...
          </Select.Trigger>
          <Select.Content class="w-full">
              {#each presetReasons as preset}
                <Select.Item value={preset} onclick={() => reason = preset}>{preset}</Select.Item>
              {/each}
          </Select.Content>
        </Select.Root>
      </div>
    </div>
    <Dialog.Footer>
      {#if type === `version`}
        <div class="flex items-center space-x-2">
          <Switch id="autosetProject" bind:checked={autosetProject} />
          <Label for="autosetProject">{m["dialogs.approvalDialog.autosetProject"]()}</Label>
        </div>
      {/if}
      <Button variant="ghost" onclick={() => (visible = false)}>{m["dialogs.cancel"]()}</Button>
      <Button type="submit" onclick={handleSubmit}>{m["dialogs.submit"]()}</Button>
    </Dialog.Footer>
  </Dialog.Content>
</Dialog.Root>
