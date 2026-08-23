<script lang="ts">
  import { i18n } from "$lib/scripts/i18n";

  const { t } = i18n();
  import { parseErrorMessage, trpc } from "$lib/scripts/utils/api";
  import { Button } from "$shadcn/components/ui/button";
  import * as Dialog from "$shadcn/components/ui/dialog";
  import { Textarea } from "$shadcn/components/ui/textarea";
  import { toast } from "svelte-sonner";

  let reason = $state<string>("");
  let name = $state<string>("");
  let id = $state<number>(0);
  let visible = $state<boolean>(false);
  let type = $state<`project` | `version` | `user` | `asset`>(`asset`);

  export function showDialog(p_id: number, p_name: string, p_type: `project` | `version` | `user` | `asset`) {
    type = p_type;
    reason = "";
    id = p_id;
    name = p_name;
    visible = true;
  }

  function handleSubmit() {
    console.log(`Reporting thing ${id} with reason: ${reason}`);
    let res = trpc.internal.requests.reportThing.mutate({
      thingId: id,
      thingType: type,
      reason: reason,
    }).then((res) => {
      console.log(`Successfully reported ${type} ${id}`);
      toast.success(t(`toasts.success.reportSubmitted`), {
        dismissable: true,
      });
      visible = false;
    }).catch((err) => {
      console.error(`Error reporting ${type} ${id}:`, err);
      toast.error(t(`toasts.error.generic`), {
        description: parseErrorMessage(err),
        dismissable: true,
        duration: 30000
      });
    });
  }
</script>

<Dialog.Root bind:open={visible}>
  <Dialog.Content class="sm:max-w-[425px]">
    <Dialog.Header>
      <Dialog.Title>{t(`dialogs.reportDialog.title`, { name })}</Dialog.Title>
      <Dialog.Description>{t(`dialogs.reportDialog.description`)}</Dialog.Description>
    </Dialog.Header>
    <div class="flex flex-row">
      <Textarea bind:value={reason} placeholder={t(`dialogs.reportDialog.reasonPlaceholder`)} />
    </div>
    <Dialog.Footer>
      <Button variant="ghost" onclick={() => (visible = false)}>{t(`dialogs.cancel`)}</Button>
      <Button type="submit" onclick={handleSubmit}>{t(`dialogs.submit`)}</Button>
    </Dialog.Footer>
  </Dialog.Content>
</Dialog.Root>
