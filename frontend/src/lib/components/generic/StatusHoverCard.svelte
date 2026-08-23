<script lang="ts">
  import { i18n } from "$lib/scripts/i18n";

  const { t } = i18n();
  import { Status } from "$lib/scripts/from_backend/DBExtras";
  import { getStatusString } from "$lib/scripts/utils/stylizer";
  import { Badge } from "$shadcn/components/ui/badge";
  import * as ToolTip from "$shadcn/components/ui/tooltip";
  import type { HTMLAttributes } from "svelte/elements";
  import { cn } from "tailwind-variants";

  let {
    status,
    type,
    textSize = `base`,
    countdownDate = null,
    children = null,
    enableHover = true,
    isMuted = false,
  }: {
    status: Status;
    type: "mod" | "asset";
    textSize?: "base" | `base-bold`;
    countdownDate?: Date | number | string | null;
    children?: any;
    enableHover?: boolean;
    isMuted?: boolean;
  } = $props();

  let style = $derived.by(() => {
    switch (status) {
      case Status.Public:
      case Status.Verified:
        return "border-green-600 text-green-200";
      case Status.Unverified:
        return "border-yellow-600 text-yellow-200";
      case Status.Queue:
      case Status.Testing:
      case Status.NonDefault_Testing:
        return "border-orange-600 text-orange-200";
      case Status.Private:
        return "border-blue-600 text-blue-200";
      default:
        return "border-red-600 text-red-200";
    }
  });

  let titleString = $derived.by(() => {
    if (type === "asset") {
      switch (status) {
        case Status.Verified:
          return t(`assets.statusHover.verified.title`);
        case Status.Unverified:
          return t(`assets.statusHover.unverified.title`);
        case Status.Queue:
          return t(`mods.statusHover.queue.title`);
        case Status.Testing:
          return t(`assets.statusHover.queue.title`);
        case Status.Private:
          return t(`assets.statusHover.private.title`);
        case Status.Removed:
          return t(`assets.statusHover.removed.title`);
        default:
          return "";
      }
    } else {
      switch (status) {
        case Status.Verified:
          return t(`mods.statusHover.verified.title`);
        case Status.Unverified:
          return t(`mods.statusHover.unverified.title`);
        case Status.Queue:
          return t(`mods.statusHover.queue.title`);
        case Status.Testing:
          return t(`mods.statusHover.testing.title`);
        case Status.Private:
          return t(`mods.statusHover.private.title`);
        case Status.Removed:
          return t(`mods.statusHover.removed.title`);
        default:
          return "";
      }
    }
  });
  let descriptionString = $derived.by(() => {
    if (type === "asset") {
      switch (status) {
        case Status.Verified:
          return t(`assets.statusHover.verified.description`);
        case Status.Unverified:
          return t(`assets.statusHover.unverified.description`);
        case Status.Queue:
        case Status.Testing:
          return t(`assets.statusHover.queue.description`);
        case Status.Private:
          return t(`assets.statusHover.private.description`);
        case Status.Removed:
          return t(`assets.statusHover.removed.description`);
        default:
          return "";
      }
    } else {
      switch (status) {
        case Status.Verified:
          return t(`mods.statusHover.verified.description`);
        case Status.Unverified:
          return t(`mods.statusHover.unverified.description`);
        case Status.Queue:
          return t(`mods.statusHover.queue.description`);
        case Status.Testing:
          return t(`mods.statusHover.testing.description`);
        case Status.Private:
          return t(`mods.statusHover.private.description`);
        case Status.Removed:
          return t(`mods.statusHover.removed.description`);
        default:
          return "";
      }
    }
  });

  // relative time left until the countdown date string, in days then hours then minutes then seconds but only showing highest value
  let timeLeft = $derived.by(() => {
    if (countdownDate) {
      const diff = Math.max(0, Math.floor((new Date(countdownDate).getTime() - Date.now()) / 1000));
      if (diff >= 86400) return `${Math.floor(diff / 86400)}d`;
      if (diff >= 3600) return `${Math.floor(diff / 3600)}h`;
      if (diff >= 60) return `${Math.floor(diff / 60)}m`;
      if (diff > 0) return `${diff}s`;
    }
    return 0;
  });
</script>

{#snippet badge()}
  <Badge variant="outline" class="capitalize {style} {isMuted ? `opacity-50` : ``}">
    <p class={textSize == `base-bold` ? `text-base` : `text-xs`}>{getStatusString(status)}</p>
    {#if countdownDate && timeLeft !== 0}
      <!-- Countdown timer-->
      <p title={new Date(countdownDate).toISOString()}>({timeLeft})</p>
    {/if}
  </Badge>
{/snippet}

{#if enableHover}
  <ToolTip.Root>
    <ToolTip.Trigger>
      {#if children}
        {@render children()}
      {:else}
        {@render badge()}
      {/if}
    </ToolTip.Trigger>
    <ToolTip.Content class="flex flex-col p-4 w-64">
      <p class="text-base font-semibold">{@html titleString}</p>
      <p class="text-xs text-gray-500">{@html descriptionString}</p>
    </ToolTip.Content>
  </ToolTip.Root>
{:else}
  {@render badge()}
{/if}
