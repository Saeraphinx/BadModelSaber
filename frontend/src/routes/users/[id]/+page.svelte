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
  import { UserPermissions } from "$lib/scripts/api/DBTypes.js";
  import { checkRoles } from "$lib/scripts/utils/checkRoles.js";
  import { Button } from "$lib/shadcn/components/ui/button/index.js";
  import ModCard from "$lib/components/mods/ModCard.svelte";
  import * as Tabs from "$lib/shadcn/components/ui/tabs/index.js";
  import { Input } from "../../../lib/shadcn/components/ui/input";
  import { Textarea } from "../../../lib/shadcn/components/ui/textarea";
  import { Label } from "../../../lib/shadcn/components/ui/label";
  import { invalidate } from "$app/navigation";

  const { data: _internal } = $props();
  const { pageData, trpc, user } = $derived(_internal);
  const pdUser = $derived(pageData.user);
  const assets = $derived(pageData.assets);
  const mods = $derived(pageData.mods);
  let dialog = $state<ApprovalDialog>();
  // svelte-ignore state_referenced_locally
  let tabsValue = $state(mods.length > 0 ? "mods" : "assets");

  // #region Edit User
  let isEditing = $state(false);
  let editDisplayName = $state(``);
  let editBio = $state(``);
  let allowEditing = $derived.by(() => {
    if (!user) return false;
    return checkRoles(user, {
      hasOneOf: pdUser.id == user.id ? [UserPermissions.Users_EditAll, UserPermissions.Users_EditSelf] : [UserPermissions.Users_EditAll]
    });
  });
  function onEditSubmit() {
    trpc.internal.updateUser.updateUser.mutate({
      displayName: editDisplayName,
      bio: editBio,
    }).then(() => {
      isEditing = false;
      tabsValue = "mods";
      toast.success(`User updated successfully`);
      invalidate((url) => url.pathname.includes(`v3.user.getUserById`));
    }).catch((err) => {
      toast.error(`Failed to update user`, { description: parseErrorMessage(err) });
    });
  }

  $effect(() => {
    if (!navigating) return;
    editBio = pdUser?.bio || "";
    editDisplayName = pdUser?.displayName || "";
  });
  // #endregion
</script>

<div class="flex flex-col items-center mx-4">
  <div class="flex flex-col md:flex-row gap-4 w-full">
    <UserCard user={pdUser} class="md:min-w-92" />
    <div class="flex flex-row bg-card p-4 rounded-lg w-full">
      <Markdown bind:markdown={pdUser.bio} class="text-base w-full" />
      {#if allowEditing || (pdUser.userPlatforms?.length ?? 0 > 0)}
        <Separator orientation="vertical" class="mx-4" />
        <div class="flex flex-col w-64 max-w-64">
          <div class="flex flex-row flex-wrap gap-2">
            {#each pdUser.userPlatforms as sponsorUrl}
              <SponsorButton class="w-full" type={sponsorUrl.platform} url={sponsorUrl.url} />
            {/each}
            {#if allowEditing && !isEditing}
              <Button variant="outline" class="w-full" onclick={() => {
                isEditing = true
                tabsValue = "edit";
              }}>
                Edit Profile
              </Button>
            {/if}
            {#if isEditing}
              <Button variant="outline" class="w-full" onclick={() => {
                isEditing = false;
                tabsValue = "mods";
              }}>
                Cancel
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
        <Tabs.Trigger value="mods">Mods</Tabs.Trigger>
        <Tabs.Trigger value="assets">Assets</Tabs.Trigger>
      {/if}
      {#if isEditing}
        <Tabs.Trigger value="edit">Edit</Tabs.Trigger>
      {/if}
    </Tabs.List>
      <Tabs.Content value="mods" class="w-full mt-4 flex flex-row flex-wrap justify-center gap-8 m-auto">
        {#each mods as mod}
          <ModCard project={mod} />
        {:else}
          <p class="text-base text-muted-foreground">No mods found for this user.</p>
        {/each}
      </Tabs.Content>
      <Tabs.Content value="assets" class="w-full mt-4 flex flex-row flex-wrap justify-evenly gap-8 m-auto">
        {#each assets as asset}
          <AssetCard {asset} size="large" approvalDialog={dialog} />
        {:else}
          <p class="text-base text-muted-foreground">No assets found for this user.</p>
        {/each}
      </Tabs.Content>
      <Tabs.Content value="edit" class="w-full mt-4 flex flex-col items-center gap-4 m-auto">
        <div class="flex flex-col justify-center w-full max-w-md p-4 gap-2 bg-card rounded-lg">
          <span class="w-full max-w-lg">
            <Label class="p-1 pb-2" for="displayName">Display Name</Label>
            <Input placeholder="Display Name" bind:value={editDisplayName} class="w-full" />
          </span>
          <span class="w-full max-w-lg">
            <Label class="p-1 pb-2" for="bio">Bio</Label>
            <Textarea placeholder="Bio" bind:value={editBio} class="w-full" />
          </span>
          <Button onclick={onEditSubmit}>Save Changes</Button>
        </div>
        {#if pdUser.id == user?.id}
          <div class="flex flex-col justify-center w-full max-w-md p-4 gap-2 bg-card rounded-lg">
            <div class="grid grid-cols-2 gap-4">
              <Button variant="outline" disabled={user?.githubId !== null} onclick={() => {
                trpc.internal.auth.linkGitHubToaccount.query({}).then(({ url }) => {
                  window.open(url, "_blank");
                }).catch((err) => {
                  toast.error(`Failed to link GitHub account`, { description: parseErrorMessage(err) });
                })
              }}>Link GitHub</Button>
              <Button variant="outline" disabled={user?.discordId !== null} onclick={() => {
                trpc.internal.auth.linkDiscordToAccount.query({}).then(({ url }) => {
                  window.open(url, "_blank");
                }).catch((err) => {
                  toast.error(`Failed to link GitHub account`, { description: parseErrorMessage(err) });
                })
              }}>Link Discord</Button>
            </div>
          </div>
        {/if}
      </Tabs.Content>
  </Tabs.Root>
</div>

<ApprovalDialog bind:this={dialog} />