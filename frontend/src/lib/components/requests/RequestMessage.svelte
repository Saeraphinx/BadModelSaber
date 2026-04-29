<script lang="ts">
  import { m } from "$lib/paraglide/messages";
  import type { RequestMessage } from "$lib/scripts/api/DBTypes";
  import { Button } from "$shadcn/components/ui/button";
  import { cn } from "$shadcn/utils";
  import type { ClassValue } from "svelte/elements";

  let {
    message,
    accept,
    reject,
    user = {
      id: -1,
      displayName: "Unknown User",
      avatarUrl: "/default-avatar.png",
    },
    class: className = "",
  } : {
    accept: Function,
    reject: Function,
    message: RequestMessage & { initMessage?: boolean };
    user?: { id:number, displayName: string; avatarUrl: string };
    class?: ClassValue;
  } = $props();
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
    {#if message.initMessage}
      <div class="flex flex-row justify-center gap-4 mt-2">
        <Button onclick={() => {reject()}} variant="secondary" class="w-1/4">{m["dialogs.reject"]()}</Button>
        <Button onclick={() => {accept()}} class="w-1/4">{m["dialogs.accept"]()}</Button>
      </div>
    {/if}
  </div>
</div>