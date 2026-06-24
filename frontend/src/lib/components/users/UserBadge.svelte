<script lang="ts">
  import { Button } from "$shadcn/components/ui/button";
  import { XIcon } from "@lucide/svelte";
  import { UserPermissions, type UserApiV3 } from "$lib/scripts/api/DBTypes";
  import type { HTMLAttributes } from "svelte/elements";
  import { cn } from "$shadcn/utils";
  import { getRoleData } from "../../scripts/utils/stylizer";

  const {
    user,
    onClick,
    small = false,
    class: className,
    ...restProps
  }: {
    user: UserApiV3;
    small?: boolean;
    onClick?: () => void;
  } & HTMLAttributes<HTMLDivElement> = $props();

  //check if user has any fancy roles and if so, add a badge for them
  let roleStyle = $derived.by(() => {
    let roleStyles = user.permissions.sitewide.map((role) => getRoleData(role)).filter((role) => !role.hidden);
    if (roleStyles.length === 0)
      return {
        badgeBorder: `bg-card`,
        textColor: `text-white`,
      };

    let developerRole = roleStyles.find((role) => role.value === UserPermissions.C_Developer);
    let bsmgStaffRole = roleStyles.find((role) => role.value === UserPermissions.C_BSMG_Staff);
    if (developerRole) return developerRole;
    if (bsmgStaffRole) return bsmgStaffRole;
    return roleStyles[0];
  });
</script>

<div class={cn(`flex items-center justify-start ${small ? `gap-1` : `gap-2`} ${roleStyle.badgeBorder} border-2 text-white rounded-full  ${onClick ? `` : `${small ? `pr-2` : `pr-3`}`}`, className)} {...restProps}>
  {#if small}
    {#if user.permissions.sitewide.includes(UserPermissions.C_System)}
      <img src="/system_pfp.svg" alt={user.displayName} class="w-6 h-6 rounded-full border-2 border-accent" />
    {:else}
      <img src={user.avatarUrl} alt={user.displayName} class="w-6 h-6 rounded-full border-2 border-accent" crossorigin="anonymous" />
    {/if}
  {:else}
   {#if user.permissions.sitewide.includes(UserPermissions.C_System)}
      <img src="/system_pfp.svg" alt={user.displayName} class="w-8 h-8 rounded-full border-2 border-accent" />
    {:else}
      <img src={user.avatarUrl} alt={user.displayName} class="w-8 h-8 rounded-full border-2 border-accent" crossorigin="anonymous" />
    {/if}
  {/if}
  <a href="/users/{user.id}" class="{small ? `text-xs` : `text-sm`}">{user.displayName}</a>
  {#if onClick}
    <Button variant="ghost" size="sm" class="has-[>svg]:px-1 has-[>svg]:pr-2 rounded-full" onclick={onClick}>
      <XIcon class="w-2 h-2 text-gray-400" />
    </Button>
  {/if}
</div>
