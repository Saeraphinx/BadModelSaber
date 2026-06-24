<script lang="ts">
  import { UserPermissions, type UserApiV3 } from '$lib/scripts/api/DBTypes';
  import { getRoleData } from '$lib/scripts/utils/stylizer.js';
  import { Badge } from '$shadcn/components/ui/badge';
  import { cn } from '$shadcn/utils';
  import type { HTMLAttributes } from 'svelte/elements';

  let {
    user,
    class: className,
    ...restProps
  }:{
    user: UserApiV3;
  } & HTMLAttributes<HTMLDivElement> = $props();
  const roleData = $derived.by(() => {
    return user.permissions.sitewide.map(r => getRoleData(r));
  });
</script>

<div class={cn("flex flex-col bg-card p-4 rounded-md", className)} {...restProps} >
  <div class="flex flex-row">
    <div class="flex w-16 min-h-full shrink-0 items-center">
      {#if user.permissions.sitewide.includes(UserPermissions.C_System)}
        <img src="/system_pfp.svg" alt={user.displayName} class="w-16 h-16 rounded-full" />
      {:else}
        <img src={user.avatarUrl} alt={user.displayName} class="w-16 h-16 rounded-full" crossorigin="anonymous" />
      {/if}
    </div>
    <div class="flex flex-col justify-center ml-4">
      <p class="text-xl pb-1 font-semibold">{user.displayName}</p>
      <div class="flex flex-row flex-wrap wrap-normal gap-1">
        {#each roleData as role}
          {#if !role.hidden}
            <Badge class="mr-1 capitalize {role.textColor} {role.bgColor}">{role.text}</Badge>
          {/if}
        {/each}
      </div>
    </div>
  </div>
</div>
