<script lang="ts">
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
      <p class="text-md">This asset has been verified by the ModelSaber team and <span class="text-green-600">is safe to use</span>!</p>
      <p class="text-xs text-gray-500 mt-2">Verified assets have been checked for malware and are safe to use. Look for the green checkmark!</p>
    {:else if props.status == Status.Unverified}
      <p class="text-md">This asset has <b>not</b> been verified by the ModelSaber team. <span class="text-orange-400">Use at your own risk!</span></p>
      <p class="text-xs text-gray-500 mt-2">Verified assets have been checked for malware and are safe to use. Look for the green checkmark!</p>
    {/if}
  </HoverCard.Content>
</HoverCard.Root>
