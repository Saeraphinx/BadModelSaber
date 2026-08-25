<script lang="ts">
  import { Button } from "$shadcn/components/ui/button";
  import { XIcon } from "@lucide/svelte";
  import { UserPermissions, type UserApiV3 } from "$lib/scripts/from_backend/DBExtras";
  import type { HTMLAttributes } from "svelte/elements";
  import { cn } from "$shadcn/utils";
  import { getRoleData } from "../../scripts/utils/stylizer";
  import { i18n } from "../../scripts/i18n";

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
  const { t } = i18n();

  //check if user has any fancy roles and if so, add a badge for them
  let roleStyle = $derived.by(() => {
    let roleStyles = user.permissions.sitewide.map((role) => getRoleData(t, role)).filter((role) => !role.hidden);
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

  let userAvatarUrl = $derived.by(() => {
    if (user.permissions.sitewide.includes(UserPermissions.C_System)) {
      return "/system_pfp.svg";
    } else if (user.avatarUrl.includes("github.com")) {
      return `/users/pfp/${user.avatarUrl.split("/").pop()}`;
    } else {
      return user.avatarUrl;
    }
  });
</script>

<div class={cn(`flex items-center justify-start ${small ? `gap-1` : `gap-2`} ${roleStyle.badgeBorder} border-2 text-white rounded-full  ${onClick ? `` : `${small ? `pr-2` : `pr-3`}`}`, className)} {...restProps}>
  {#if small}
    <img src={userAvatarUrl} alt={user.displayName} class="w-6 h-6 rounded-full border-2 border-accent" crossorigin="anonymous" />
  {:else}
    <img src={userAvatarUrl} alt={user.displayName} class="w-8 h-8 rounded-full border-2 border-accent" crossorigin="anonymous" />
  {/if}
  <a href="/users/{user.id}" class="{small ? `text-xs` : `text-sm`}">{user.displayName}</a>
  {#if onClick}
    <Button variant="ghost" size="sm" class="has-[>svg]:px-1 has-[>svg]:pr-2 rounded-full" onclick={onClick}>
      <XIcon class="w-2 h-2 text-gray-400" />
    </Button>
  {/if}
</div>
