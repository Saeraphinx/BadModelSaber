<script lang="ts">
  import { AlertType, type AlertApiV3 } from '$lib/scripts/from_backend/DBExtras';
  import { parseErrorMessage, trpc, handleTrpcErrorWithToast } from '$lib/scripts/utils/api';
  import Button from '$shadcn/components/ui/button/button.svelte';
  import { cn } from '$shadcn/utils';
  import { ExternalLinkIcon } from '@lucide/svelte';
  import { toast } from 'svelte-sonner';
  import type { HTMLAttributes } from 'svelte/elements';
  import { m } from "$lib/paraglide/messages";

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
  let isPendingHidden = $state(false);

  let bgColor = $derived.by(() => {
    switch (alert.type) {
      case AlertType.RequestAccepted:
      case AlertType.ThingGood:
        return 'bg-green-800/20';
      case AlertType.ThingBad:
        return 'bg-red-800/20';
      case AlertType.RequestDeclined:
      case AlertType.ThingWarn:
        return 'bg-yellow-800/20';
      case AlertType.ThingInfo:
        return 'bg-blue-800/20';
      default:
        return 'bg-gray-800';
    }
  });

  function markRead() {
    isPendingHidden = true;
    setTimeout(() => {
      if (deleteFromArray) {
        deleteFromArray();
      } else {
        isVisible = false;
      }
      isPendingHidden = false;
    }, 500);
    trpc.internal.alerts.markAlertRead.mutate({ id: alert.id }).catch(handleTrpcErrorWithToast());
  }

  function deleteAlert() {
    isPendingHidden = true;
    setTimeout(() => {
      if (deleteFromArray) {
        deleteFromArray();
      } else {
        isVisible = false;
      }
      isPendingHidden = false;
    }, 500);
    trpc.internal.alerts.deleteAlert.mutate({ id: alert.id }).catch(handleTrpcErrorWithToast());
  }
</script>

<div class={cn(`${bgColor} ${isVisible ? `` : `hidden`} ${isPendingHidden ? `translate-x-100 transition-transform duration-500` : ``} rounded-xl p-4`, className)} {...restProps}>
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
    <Button variant="outline" onclick={markRead}>
      Mark as Read
    </Button>
    {:else}
    <Button variant="destructive" onclick={deleteAlert}>
      Delete
    </Button>
    {/if}
  </div>
</div>
