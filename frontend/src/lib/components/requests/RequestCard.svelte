<script lang="ts">
  import { type ThingRequestApiV3 } from "$lib/scripts/from_backend/DBExtras";
  import { cn } from "$shadcn/utils";
  import { MessageSquareTextIcon } from "@lucide/svelte";
  import type { HTMLAttributes } from "svelte/elements";
  import { m } from "../../paraglide/messages";

  let {
    request,
    class: className,
  }: {
    request: ThingRequestApiV3;
  } & HTMLAttributes<HTMLDivElement> = $props();

  let requestTypeTitleString = $derived.by(() => {
    return m[`enums.requestTypes.${request.requestType}`]();
  });
</script>

<div class={cn("p-4 border rounded-md shadow-sm hover:shadow-md transition-shadow", className)}>
  <a href={`/requests/${request.id}`} class="text-blue-600 hover:underline">
    <p>{requestTypeTitleString}: {request.refrencedThingName}</p>
  </a>
  <div class="relative">
    <a href="/users/{request.requesterId}" class="text-sm text-gray-500 mt-1">{m["requests.createdBy"]({name: request.requester?.displayName ?? ``})}</a>
    <p class="text-sm text-gray-500 mt-1">{m["requests.createdAt"]({ date: new Date(request.createdAt).toLocaleDateString()})}</p>
    {#if request.requestType.includes("report")}
      <div class="absolute bottom-0 right-0 flex items-center mt-2">
        <MessageSquareTextIcon class="text-gray-500" />
        <span class="ml-1 text-gray-500 text-base">{request.messages.length}</span>
      </div>
    {/if}
  </div>
</div>