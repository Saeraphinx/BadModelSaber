<script lang="ts">
  import { RequestType, type AssetRequestPublicAPIv3 } from "$lib/scripts/api/DBTypes";
  import { cn } from "$shadcn/utils";
  import { MessageSquareTextIcon } from "@lucide/svelte";
  import type { ClassValue, HTMLAttributes } from "svelte/elements";

  let {
    request,
    class: className,
  }: {
    request: AssetRequestPublicAPIv3;
  } & HTMLAttributes<HTMLDivElement> = $props();

  let requestTypeTitleString = $derived.by(() => {
    switch (request.requestType) {
      case RequestType.Report:
        return "Report";
      case RequestType.Credit:
        return "Collaborator Request";
      case RequestType.Link:
        return "Related Asset Link Request";
      default:
        return "Request";
    }
  });
</script>

<div class={cn("p-4 border rounded-lg shadow-sm hover:shadow-md transition-shadow", className)}>
  <a href={`/requests/${request.id}`} class="text-blue-600 hover:underline">
    <p>{requestTypeTitleString}: {request.refrencedAsset?.name}</p>
  </a>
  <div class="relative">
    <p class="text-sm text-gray-500 mt-1">{request.requestType === RequestType.Report ? `Request` : `Created`} by {request.requester?.displayName}</p>
    <p class="text-sm text-gray-500 mt-1">Created at: {new Date(request.createdAt).toLocaleDateString()}</p>
    {#if request.requestType === RequestType.Report}
      <div class="absolute bottom-0 right-0 flex items-center mt-2">
        <MessageSquareTextIcon class="text-gray-500" />
        <span class="ml-1 text-gray-500 text-base">{request.messages.length}</span>
      </div>
    {/if}
  </div>
</div>