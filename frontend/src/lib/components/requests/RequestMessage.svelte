<script lang="ts">
  import type { RequestMessage } from "$lib/scripts/api/DBTypes";
  import { Button } from "$shadcn/components/ui/button";
  import { cn } from "$shadcn/utils";
  import type { ClassValue } from "svelte/elements";

  let {
    message,
    user = {
      id: "unknown",
      displayName: "Unknown User",
      avatarUrl: "/default-avatar.png",
    },
    class: className = "",
  } : {
    message: RequestMessage;
    user?: { id:string, displayName: string; avatarUrl: string };
    class?: ClassValue;
  } = $props();

  let isDecisionMessage = $derived.by(() => {
    return message.message.includes(`Would you like to accept or reject this request?`) && message.userId === `5`;
  });
</script>

<div class={cn(`p-4 bg-card rounded-lg shadow`, className)}>
  <div class="flex items-center mb-2 justify-between">
    <a href="/users/{user.id}" class="flex flex-row items-center">
      <img src={user.avatarUrl} alt={user.displayName} class="w-8 h-8 rounded-full mr-2" />
      <span class="font-semibold">{user.displayName}</span>
    </a>
    <span class="text-sm text-gray-500 ml-2">{new Date(message.timestamp).toLocaleString()}</span>
  </div>
  <div class="text-gray-800 dark:text-gray-200">
    <p class="whitespace-pre-line">{message.message}</p>
    {#if isDecisionMessage}
      <div class="flex flex-row justify-center gap-4 mt-2">
        <Button variant="secondary" class="w-1/4">Reject</Button>
        <Button class="w-1/4">Accept</Button>
      </div>
    {/if}
  </div>
</div>