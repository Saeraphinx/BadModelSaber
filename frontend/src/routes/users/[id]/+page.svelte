<script lang="ts">
  import ApprovalDialog from "$lib/components/dialogs/ApprovalDialog.svelte";
  import AssetCard from "$lib/components/assets/AssetCard.svelte";
  import SponsorButton from "$lib/components/users/SponsorButton.svelte";
  import UserCard from "$lib/components/users/UserCard.svelte";
  import Separator from "$shadcn/components/ui/separator/separator.svelte";
  import Markdown from "$lib/components/generic/Markdown.svelte";
  import { toast } from "svelte-sonner";
  import { parseErrorMessage } from "$lib/scripts/utils/api.js";
  import { navigating } from "$app/state";
  import { PlatformType, UserPermissions, type UserApiV3 } from "$lib/scripts/from_backend/DBExtras.js";
  import { checkRoles } from "$lib/scripts/utils/checkRoles.js";
  import { Button } from "$lib/shadcn/components/ui/button/index.js";
  import ModCard from "$lib/components/mods/ModCard.svelte";
  import * as Tabs from "$lib/shadcn/components/ui/tabs/index.js";
  import { Input } from "$lib/shadcn/components/ui/input";
  import { Textarea } from "$lib/shadcn/components/ui/textarea";
  import { Label } from "$lib/shadcn/components/ui/label";
  import { invalidate } from "$app/navigation";
  import Checkbox from "../../../lib/shadcn/components/ui/checkbox/checkbox.svelte";
  import RolesEditorDialog from "../../../lib/components/dialogs/RolesEditorDialog.svelte";
  import z from "zod/v4";
  import * as Select from "../../../lib/shadcn/components/ui/select";
  import { XIcon } from "@lucide/svelte";
  import { i18n } from "../../../lib/scripts/i18n";

  const { t } = i18n();
  const { data: _internal } = $props();
  const { pageData, trpc, user } = $derived(_internal);
  const pdUser = $derived(pageData.user);
  const assets = $derived(pageData.assets);
  const mods = $derived(pageData.mods);
  let bio = $derived.by(() => {
    let bio = pdUser.bio || "";
    if (pdUser.permissions.sitewide.includes(UserPermissions.C_System)) {
      bio = pdUser.bio + `\n\n---\nThis user account is used for system operations and is not meant to be used by anyone.\n\nBadModelSaber is developed by [Saeraphinx](https://saeraphinx.dev) and the [Beat Saber Modding Group](https://bsmg.wiki). If you need to contact us, you can find links to our support channels on our Wiki: https://bsmg.wiki/contact-us`
    }
    return bio;
  });
  let dialog = $state<ApprovalDialog>();
  // svelte-ignore state_referenced_locally
  let tabsValue = $state(mods.length > 0 ? "mods" : "assets");

  // #region Edit User
  let isEditing = $state(false);
  let editDisplayName = $state(``);
  let editBio = $state(``);
  let editHideDiscordId = $state(false);
  let editHideGithubId = $state(false);
  let editUserPlatforms: UserApiV3['userPlatforms'] = $state([]);
  let allowEditing = $derived.by(() => {
    if (!user) return false;
    return checkRoles(user, {
      hasOneOf: pdUser.id == user.id ? [UserPermissions.Users_EditAll, UserPermissions.Users_EditSelf] : [UserPermissions.Users_EditAll]
    });
  });
  let allowEditingConfidentials = $derived.by(() => {
    if (!user) return false;
    if (pdUser.id === user.id) return true;
    return false;
  });
  function onEditSubmit() {
    let editData: {
      id: number;
      displayName: string;
      bio: string;
      hideDiscordId?: boolean;
      hideGithubId?: boolean;
      userPlatforms: { platform: PlatformType; username: string }[];
    } = {
      id: pdUser.id,
      displayName: editDisplayName,
      bio: editBio,
      userPlatforms: editUserPlatforms as { platform: PlatformType; username: string }[],
    };

    if (allowEditingConfidentials) {
      editData.hideDiscordId = editHideDiscordId;
      editData.hideGithubId = editHideGithubId;
    }

    trpc.internal.updateThings.user.updateUser.mutate(editData).then(() => {
      isEditing = false;
      tabsValue = "mods";
      toast.success(t(`toasts.success.savedChanges`));
      invalidate((url) => url.pathname.includes(`v3.user.getUserById`));
    }).catch((err) => {
      toast.error(t(`toasts.error.generic`), { description: parseErrorMessage(err) });
    });
  }

  $effect(() => {
    if (!navigating) return;
    editBio = pdUser?.bio || "";
    editDisplayName = pdUser?.displayName || "";
    editHideDiscordId = user?.hideDiscordId || false;
    editHideGithubId = user?.hideGithubId || false;
    editUserPlatforms = pdUser?.userPlatforms || [];
  });
  // #endregion

  let showBanButton = $derived.by(() => checkRoles(user, [UserPermissions.Users_Ban]));
  let showEditButton = $derived.by(() => allowEditing && !isEditing);
  let showEditRolesButton = $derived.by(() => checkRoles(user, [UserPermissions.Users_EditAllRoles]));
  let showSomeLinkedButtons = $derived.by(() => ((pdUser.userPlatforms?.length ?? 0 > 0) || pdUser.githubId || pdUser.discordId));

  let roleEditorDialog: RolesEditorDialog;
</script>

<div class="flex flex-col items-center mx-4">
  <div class="flex flex-col md:flex-row gap-4 w-full">
    <UserCard user={pdUser} class="md:min-w-92" />
    <div class="flex flex-row bg-card p-4 rounded-lg w-full">
      <Markdown bind:markdown={bio} class="text-base w-full prose-hr:m-2 prose-hr:pb-2" />
      <!-- User platforms and edit button section -->
      {#if showSomeLinkedButtons || showEditButton || showBanButton}
        <Separator orientation="vertical" class="mx-4" />
        <div class="flex flex-col w-64 max-w-64">
          <div class="flex flex-row flex-wrap gap-2">
            <!-- Sponsor buttons & user linked ids section -->
            {#if pdUser.githubId}
              {#await fetch(`https://api.github.com/user/${pdUser.githubId}`).then(res => res.json()) then githubUser}
                <SponsorButton class="w-full" type="profile_github" username={githubUser.login} />
              {/await}
            {/if}
            {#if pdUser.discordId}
              <SponsorButton class="w-full" type="profile_discord" username={pdUser.discordId} />
            {/if}
            {#each pdUser.userPlatforms as sponsorUrl}
              <SponsorButton class="w-full" type={sponsorUrl.platform} username={sponsorUrl.username} />
            {/each}
            {#if (showSomeLinkedButtons || pdUser.githubId || pdUser.discordId) && (showEditButton || showBanButton || showEditRolesButton)}
                <Separator orientation="horizontal" />
            {/if}
            <!-- Edit button section -->
            {#if allowEditing && !isEditing}
              <Button variant="outline" class="w-full" onclick={() => {
                isEditing = true
                tabsValue = "edit";
              }}>
                {t(`dialogs.edit`)}
              </Button>
            {/if}
            {#if isEditing}
              <Button variant="outline" class="w-full" onclick={() => {
                isEditing = false;
                tabsValue = "mods";
              }}>
                {t(`dialogs.cancel`)}
              </Button>
            {/if}
            <!-- Ban button section -->
            {#if !isEditing && showBanButton}
              {#if pdUser.permissions.sitewide.includes(UserPermissions.C_Banned)}
                <Button variant="outline" class="w-full" onclick={() => {
                  if (confirm("Are you sure you want to unban this user?")) {
                    trpc.internal.admin.user.banUser.mutate({ userId: pdUser.id, ban: false}).then(() => {
                      toast.success("User unbanned.");
                    }).catch((err) => {
                      toast.error(t(`toasts.error.generic`), { description: parseErrorMessage(err) });
                    });
                  }
                }}>
                  Unban
                </Button>
              {:else}
                <Button variant="destructive" class="w-full" onclick={() => {
                  if (confirm("Are you sure you want to ban this user?")) {
                    trpc.internal.admin.user.banUser.mutate({ userId: pdUser.id, ban: true}).then(() => {
                      toast.success("User banned.");
                    }).catch((err) => {
                      toast.error(t(`toasts.error.generic`), { description: parseErrorMessage(err) });
                    });
                  }
                }}>
                  Ban
                </Button>
              {/if}
            {/if}
            {#if !isEditing && showEditRolesButton}
              <Button variant="outline" class="w-full" onclick={() => {
                roleEditorDialog.showDialog(pdUser);
              }}>
                Edit Roles
              </Button>
            {/if}
          </div>
        </div>
      {/if}
    </div>
  </div>
  <Separator class="my-4 w-full" />
  <Tabs.Root bind:value={tabsValue} class="w-full">
    <Tabs.List variant="line" class="justify-center items-center m-auto">
      {#if !isEditing}
        <Tabs.Trigger value="mods">{t(`common.mods`)}</Tabs.Trigger>
        <Tabs.Trigger value="assets">{t(`common.assets`)}</Tabs.Trigger>
      {/if}
      {#if isEditing}
        <Tabs.Trigger value="edit">{t(`dialogs.edit`)}</Tabs.Trigger>
      {/if}
    </Tabs.List>
      <Tabs.Content value="mods" class="w-full mt-4 flex flex-row flex-wrap justify-center gap-8 m-auto">
        {#each mods as mod}
          <ModCard project={mod} />
        {:else}
          <p class="text-base text-muted-foreground">{t(`mods.noModsFound`)}</p>
        {/each}
      </Tabs.Content>
      <Tabs.Content value="assets" class="w-full mt-4 flex flex-row flex-wrap justify-evenly gap-8 m-auto">
        {#each assets as asset}
          <AssetCard {asset} size="large" approvalDialog={dialog} />
        {:else}
          <p class="text-base text-muted-foreground">{t(`assets.noAssetsFound`, { name: pdUser.displayName })}</p>
        {/each}
      </Tabs.Content>
      <Tabs.Content value="edit" class="w-full mt-4 flex flex-col items-center gap-4 m-auto">
        <div class="flex flex-col justify-center w-full max-w-md p-4 gap-4 bg-card rounded-lg">
          <div class="w-full max-w-lg">
            <Label class="p-1 pb-2" for="displayName">{t(`users.displayName`)}</Label>
            <Input placeholder="Display Name" bind:value={editDisplayName} class="w-full" />
          </div>
          <div class="w-full max-w-lg">
            <Label class="p-1 pb-2" for="bio">{t(`users.bio`)}</Label>
            <Textarea placeholder="Bio" bind:value={editBio} class="w-full" />
          </div>
          <!-- UserPlatforms Linking -->
        <div class="w-full max-w-lg">
          <div class="flex flex-row justify-between items-center pb-2">
            <p class="text-sm font-semibold ml-1">{t(`users.donationLinks`)}</p>
            <Button size="sm" variant="outline" class="h-6" onclick={() => {
              editUserPlatforms = [...(editUserPlatforms ?? []), { platform: PlatformType.GitHub, username: "" }];
            }}>{t(`dialogs.add`)}</Button>
          </div>
          <div class="flex flex-col gap-2">
            {#each editUserPlatforms as eUP}
              <div class="grid grid-cols-[1.5fr_2fr_0.3fr] gap-2">
                <Select.Root type="single" bind:value={eUP.platform}>
                  <Select.Trigger class="w-full">
                    {eUP.platform.replace("_", " ")}
                  </Select.Trigger>
                  <Select.Content class="w-full">
                    {#each Object.values(PlatformType) as platform}
                      <Select.Item placeholder="Username" value={platform}>{platform.replace("_", " ")}</Select.Item>
                    {/each}
                  </Select.Content>
                </Select.Root>
                <Input placeholder={t(`users.username`)} bind:value={eUP.username} aria-invalid={!z.string().regex(/^[a-zA-Z0-9_-]{3,16}$/).safeParse(eUP.username).success} class="w-full" />
                <Button variant="destructive" size="icon" onclick={() => {
                  editUserPlatforms = editUserPlatforms ? editUserPlatforms.filter((up) => up !== eUP) : [];
                }}><XIcon /></Button>
              </div>
            {/each}
          </div>
        </div>
          {#if allowEditingConfidentials}
            <div class="flex flex-row justify-center items-center gap-4">
              <div class="flex flex-row justify-center items-center gap-2">
                <Checkbox bind:checked={editHideDiscordId} />
                <Label for="hideDiscordId">{t(`users.hideDiscordId`)}</Label>
              </div>
              <div class="flex flex-row justify-center items-center gap-2">
                <Checkbox bind:checked={editHideGithubId} />
                <Label for="hideGithubId">{t(`users.hideGithubId`)}</Label>
              </div>
            </div>
          {/if}
          <Button onclick={onEditSubmit}>{t(`dialogs.saveChanges`)}</Button>
        </div>
        {#if allowEditingConfidentials}
          <div class="flex flex-col justify-center w-full max-w-md p-4 gap-2 bg-card rounded-lg">
            <div class="grid grid-cols-2 gap-4">
              <Button variant="outline" disabled={user?.githubId !== null} onclick={() => {
                trpc.internal.auth.linkGitHubToaccount.query({}).then(({ url }) => {
                  window.open(url, "_blank");
                }).catch((err) => {
                  toast.error(t(`toasts.error.generic`), { description: parseErrorMessage(err) });
                })
              }}>{t(`users.linkToGithub`)}</Button>
              <Button variant="outline" disabled={user?.discordId !== null} onclick={() => {
                trpc.internal.auth.linkDiscordToAccount.query({}).then(({ url }) => {
                  window.open(url, "_blank");
                }).catch((err) => {
                  toast.error(t(`toasts.error.generic`), { description: parseErrorMessage(err) });
                })
              }}>{t(`users.linkToDiscord`)}</Button>
            </div>
          </div>
        {/if}
      </Tabs.Content>
  </Tabs.Root>
</div>

<ApprovalDialog bind:this={dialog} />
<RolesEditorDialog bind:this={roleEditorDialog} />