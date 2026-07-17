<script lang="ts">
  import { m } from "$lib/paraglide/messages";
  import { Status } from "$lib/scripts/from_backend/DBExtras";
  import { getStatusString } from "$lib/scripts/utils/stylizer";
  import { Badge } from "$shadcn/components/ui/badge";
  import * as HoverCard from "$shadcn/components/ui/hover-card";

  let props: {
    status: Status;
    type: "mod" | "asset";
    children?: any;
  } = $props();

  let style = $derived.by(() => {
    switch (props.status) {
      case Status.Verified:
        return "border-green-600 text-green-200";
      case Status.Unverified:
        return "border-yellow-600 text-yellow-200";
      case Status.Queue:
      case Status.Testing:
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
</script>

<HoverCard.Root>
  <HoverCard.Trigger data-sveltekit-preload-data="false">
    {#if props.children}
      {@render props.children()}
    {:else}
      <Badge variant="outline" class="capitalize {style}">{getStatusString(props.status)}</Badge>
    {/if}
  </HoverCard.Trigger>
  <HoverCard.Content class="w-64">
    <p class="text-md">{@html titleString}</p>
    <p class="text-xs text-gray-500 mt-2">{@html descriptionString}</p>
  </HoverCard.Content>
</HoverCard.Root>
