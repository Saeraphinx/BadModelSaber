<script lang="ts">
  import { m } from "$lib/paraglide/messages";
  import { Status } from "$lib/scripts/api/DBTypes";
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
      case Status.Pending:
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
        case Status.Pending:
          return m["assets.statusHover.pending.title"]();
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
        case Status.Pending:
          return m["mods.statusHover.pending.title"]();
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
        case Status.Pending:
          return m["assets.statusHover.pending.description"]();
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
        case Status.Pending:
          return m["mods.statusHover.pending.description"]();
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
  <HoverCard.Trigger>
    {#if props.children}
      {@render props.children()}
    {:else}
      <Badge variant="outline" class="capitalize {style}">{getStatusString(props.status)}</Badge>
    {/if}
  </HoverCard.Trigger>
  <HoverCard.Content class="w-64">
    <p class="text-md">{@html titleString}</p>
    <p class="text-xs text-gray-500 mt-2">{@html descriptionString}</p>
    <!-- {#if props.type === "asset"}
      {#if props.status == Status.Verified}
        <p class="text-md">{@html m["assets.statusHover.verified.title"]()}</p>
        <p class="text-xs text-gray-500 mt-2">{m["assets.statusHover.verified.description"]()}</p>
      {:else if props.status == Status.Unverified}
        <p class="text-md">{@html m["assets.statusHover.unverified.title"]()}</p>
        <p class="text-xs text-gray-500 mt-2">{m["assets.statusHover.unverified.description"]()}</p>
      {:else if props.status == Status.Pending}

      {/if}
    {:else if props.type === "mod"}
      {#if props.status == Status.Verified}
        <p class="text-md">{@html m["mods.statusHover.verified.title"]()}</p>
        <p class="text-xs text-gray-500 mt-2">{m["mods.statusHover.verified.description"]()}</p>
      {:else if props.status == Status.Unverified}
        <p class="text-md">{@html m["mods.statusHover.unverified.title"]()}</p>
        <p class="text-xs text-gray-500 mt-2">{@html m["mods.statusHover.unverified.description"]()}</p>
      {:else if props.status == Status.Pending} Pending or other statuses
        <p class="text-md">{@html m["mods.statusHover.pending.title"]()}</p>
        <p class="text-xs text-gray-500 mt-2">{@html m["mods.statusHover.pending.description"]()}</p>
      {/if}
    {/if} -->
  </HoverCard.Content>
</HoverCard.Root>
