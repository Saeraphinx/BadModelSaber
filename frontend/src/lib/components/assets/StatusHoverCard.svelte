<script lang="ts">
  import { m } from "$lib/paraglide/messages";
  import { Status } from "$lib/scripts/api/DBTypes";
  import * as HoverCard from "$shadcn/components/ui/hover-card";

  let props: {
    status: Status;
    children: any;
  } = $props();
</script>

<HoverCard.Root>
  <HoverCard.Trigger>
    {@render props.children()}
  </HoverCard.Trigger>
  <HoverCard.Content class="w-64">
    {#if props.status == Status.Verified}
      <p class="text-md">{@html m["assets.statusHover.verified.title"]()}</p>
      <p class="text-xs text-gray-500 mt-2">{m["assets.statusHover.verified.description"]()}</p>
    {:else if props.status == Status.Unverified}
      <p class="text-md">{@html m["assets.statusHover.unverified.title"]()}</p>
      <p class="text-xs text-gray-500 mt-2">{m["assets.statusHover.unverified.description"]()}</p>
    {/if}
  </HoverCard.Content>
</HoverCard.Root>
