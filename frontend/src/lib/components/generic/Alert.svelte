<script lang="ts">
  import { AlertType, type AlertApiV3 } from '$lib/scripts/api/DBTypes';
  import { parseErrorMessage, trpc } from '$lib/scripts/utils/api';
  import Button from '$shadcn/components/ui/button/button.svelte';
  import { cn } from '$shadcn/utils';
  import { ExternalLinkIcon } from '@lucide/svelte';
  import { toast } from 'svelte-sonner';
  import type { HTMLAttributes } from 'svelte/elements';
  import { m } from '../../paraglide/messages';

  let {
    alert,
    showRead = $bindable(false),
    deleteFromArray,
    class: className,
    ...restProps
  }: {
    alert: AlertApiV3;
    deleteFromArray?: () => void;
    showRead?: boolean;
  } & HTMLAttributes<HTMLDivElement> = $props();

  let isVisible = $state(true);

  let bgColor = $derived.by(() => {
    switch (alert.type) {
      case AlertType.RequestAccepted:
      case AlertType.ThingVerified:
        return 'bg-green-800/20';
      case AlertType.ThingRejected:
        return 'bg-red-800/20';
      case AlertType.RequestDeclined:
      case AlertType.ThingRemoval:
        return 'bg-yellow-800/20';
      default:
        return 'bg-gray-800';
    }
  });

  function markRead() {
    isVisible = false;
    trpc.internal.alerts.markAlertRead.mutate({ id: alert.id }).catch((error) => {
      console.error('Failed to mark alert as read:', error);
      toast.error(m["toasts.error.generic"](), {
        description: parseErrorMessage(error),
      });
    });
    if (deleteFromArray) {
      deleteFromArray();
    }
  }

  function deleteAlert() {
    isVisible = false;
     trpc.internal.alerts.deleteAlert.mutate({ id: alert.id }).catch((error) => {
      console.error('Failed to delete alert:', error);
      toast.error(m["toasts.error.generic"](), {
        description: parseErrorMessage(error),
      });
    });
    if (deleteFromArray) {
      deleteFromArray();
    }
  }
</script>

<div class={cn(`${bgColor} ${isVisible ? `` : `hidden`} rounded-xl p-4`,className)} {...restProps}>
  <div class="flex items-center justify-between">
    <span class="font-semibold text-foreground">{alert.header}</span>
    <span class="text-sm text-gray-500">{new Date(alert.createdAt).toLocaleDateString()}</span>
  </div>
  <p class="mt-1 text-sm text-muted-foreground">{alert.message}</p>
  <div class="mt-2 flex justify-end gap-2">
    {#if alert.assetId}
      <Button href={`/assets/${alert.assetId}`}>
        View Asset
        <ExternalLinkIcon class="h-4 w-4" />
      </Button>
    {/if}
    {#if alert.requestId}
      <Button href={`/requests/${alert.requestId}`}>
        View Request
        <ExternalLinkIcon class="h-4 w-4" />
      </Button>
    {/if}
    {#if !alert.read}
    <Button variant="outline" onclick={() => {
      if (!showRead) {
        isVisible = false;
      }
      markRead();
    }}>
      Mark as Read
    </Button>
    {:else}
    <Button variant="destructive" onclick={() => {
      isVisible = false
      deleteAlert();
    }}>
      Delete
    </Button>
    {/if}
  </div>
</div>
