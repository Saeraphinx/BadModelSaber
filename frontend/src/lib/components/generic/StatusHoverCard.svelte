<script lang="ts">
  import { m } from "$lib/paraglide/messages";
  import { Status } from "$lib/scripts/from_backend/DBExtras";
  import { getStatusString } from "$lib/scripts/utils/stylizer";
  import { Badge } from "$shadcn/components/ui/badge";
  import * as ToolTip from "$shadcn/components/ui/tooltip";

  let props: {
    status: Status;
    type: "mod" | "asset";
    countdownDate?: Date | number | string | null;
    children?: any;
  } = $props();

  let style = $derived.by(() => {
    switch (props.status) {
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
    if (props.type === "asset") {
      switch (props.status) {
        case Status.Verified:
          return m["assets.statusHover.verified.title"]();
        case Status.Unverified:
          return m["assets.statusHover.unverified.title"]();
        case Status.Queue:
          return m["mods.statusHover.queue.title"]();
        case Status.Testing:
          return m["assets.statusHover.queue.title"]();
        case Status.Private:
          return m["assets.statusHover.private.title"]();
        case Status.Removed:
          return m["assets.statusHover.removed.title"]();
        default:
          return "";
      }
    } else {
      switch (props.status) {
        case Status.Verified:
          return m["mods.statusHover.verified.title"]();
        case Status.Unverified:
          return m["mods.statusHover.unverified.title"]();
        case Status.Queue:
          return m["mods.statusHover.queue.title"]();
        case Status.Testing:
          return m["mods.statusHover.testing.title"]();
        case Status.Private:
          return m["mods.statusHover.private.title"]();
        case Status.Removed:
          return m["mods.statusHover.removed.title"]();
        default:
          return "";
      }
    }
  });
  let descriptionString = $derived.by(() => {
    if (props.type === "asset") {
      switch (props.status) {
        case Status.Verified:
          return m["assets.statusHover.verified.description"]();
        case Status.Unverified:
          return m["assets.statusHover.unverified.description"]();
        case Status.Queue:
        case Status.Testing:
          return m["assets.statusHover.queue.description"]();
        case Status.Private:
          return m["assets.statusHover.private.description"]();
        case Status.Removed:
          return m["assets.statusHover.removed.description"]();
        default:
          return "";
      }
    } else {
      switch (props.status) {
        case Status.Verified:
          return m["mods.statusHover.verified.description"]();
        case Status.Unverified:
          return m["mods.statusHover.unverified.description"]();
        case Status.Queue:
          return m["mods.statusHover.queue.description"]();
        case Status.Testing:
          return m["mods.statusHover.testing.description"]();
        case Status.Private:
          return m["mods.statusHover.private.description"]();
        case Status.Removed:
          return m["mods.statusHover.removed.description"]();
        default:
          return "";
      }
    }
  });

  // relative time left until the countdown date string, in days then hours then minutes then seconds but only showing highest value
  let timeLeft = $derived.by(() => {
    if (props.countdownDate) {
      const diff = Math.max(0, Math.floor((new Date(props.countdownDate).getTime() - Date.now()) / 1000));
      if (diff >= 86400) return `${Math.floor(diff / 86400)}d`;
      if (diff >= 3600) return `${Math.floor(diff / 3600)}h`;
      if (diff >= 60) return `${Math.floor(diff / 60)}m`;
      if (diff > 0) return `${diff}s`;
    }
    return 0;
  });
</script>

<ToolTip.Root>
  <ToolTip.Trigger>
    {#if props.children}
      {@render props.children()}
    {:else}
      <Badge variant="outline" class="capitalize {style}">
        <p>{getStatusString(props.status)}</p>
        {#if props.countdownDate && timeLeft !== 0}
          <!-- Countdown timer-->
          <p title={new Date(props.countdownDate).toISOString()}>({timeLeft})</p>
        {/if}
      </Badge>
    {/if}
  </ToolTip.Trigger>
  <ToolTip.Content class="flex flex-col p-4 w-64">
    <p class="text-base font-semibold">{@html titleString}</p>
    <p class="text-xs text-gray-500">{@html descriptionString}</p>
  </ToolTip.Content>
</ToolTip.Root>
