<script lang="ts">
  import type { UserPublicAPIv3 } from '$lib/scripts/api/DBTypes';
  import { getRoleData } from '$lib/scripts/utils/stylizer.js';
  import { Badge } from '$shadcn/components/ui/badge';
  import { cn } from '$shadcn/utils';
  import type { HTMLAttributes } from 'svelte/elements';

  let {
    user,
    class: className,
    ...restProps
  }:{
    user: UserPublicAPIv3;
  } & HTMLAttributes<HTMLDivElement> = $props();
  const roleData = $derived.by(() => {
    return user.roles.map(role => getRoleData(role));
  });
</script>

<div class={cn("flex flex-row bg-accent p-4 rounded-lg", className)} {...restProps} >
  <div class="flex w-16 min-h-full flex-shrink-0 items-center">
    <img src={user.avatarUrl} alt={user.displayName} class="w-16 h-16 rounded-full" />
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
