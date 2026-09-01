<script lang="ts">
  import { m } from "$lib/paraglide/messages";
  import type { RequestMessage, UserPermissions } from "$lib/scripts/from_backend/DBExtras";
  import { Button } from "$shadcn/components/ui/button";
  import { Badge } from "$shadcn/components/ui/badge";
  import { cn } from "$shadcn/utils";
  import type { ClassValue } from "svelte/elements";
  import { getRoleData } from "../../scripts/utils/stylizer";

  let {
    message,
    accept,
    reject,
    user = {
      id: -1,
      displayName: "Unknown User",
      avatarUrl: "/default-avatar.png",
      useSystemAvatar: false,
    },
    class: className = "",
  } : {
    accept: Function,
    reject: Function,
    message: RequestMessage & { initMessage?: boolean };
    user?: { id:number, displayName: string; avatarUrl: string; useSystemAvatar: boolean, displayRole?: UserPermissions } ;
    class?: ClassValue;
  } = $props();

  let userAvatarUrl = $derived.by(() => {
    if (user.useSystemAvatar) {
      return "/system_pfp.svg";
    } else if (user.avatarUrl.includes("github.com")) {
      return `/users/pfp/${user.avatarUrl.split("/").pop()}`;
    } else {
      return user.avatarUrl;
    }
  });
</script>

<div class={cn(`p-4 bg-card rounded-lg shadow`, className)}>
  <div class="flex items-center mb-2 justify-between">
    <a href="/users/{user.id}" class="flex flex-row items-center gap-2">
      <img src={userAvatarUrl} alt={user.displayName} class="w-8 h-8 rounded-full"/>
      <span class="font-semibold">{user.displayName}</span>
      {#if user.displayRole}
        {const role = getRoleData(user.displayRole);}
        <Badge class="mr-1 capitalize {role.textColor} {role.bgColor}">{role.text}</Badge>
      {/if}

    </a>
    <span class="text-sm text-gray-500 ml-2">{new Date(message.timestamp).toLocaleString()}</span>
  </div>
  <div class="text-gray-800 dark:text-gray-200">
    <p class="whitespace-pre-line">{message.message}</p>
    {#if message.initMessage}
      <div class="flex flex-row justify-center gap-4 mt-2">
        <Button onclick={() => {reject()}} variant="secondary" class="w-1/4">{m[`dialogs.reject`]()}</Button>
        <Button onclick={() => {accept()}} class="w-1/4">{m[`dialogs.accept`]()}</Button>
      </div>
    {/if}
  </div>
</div>