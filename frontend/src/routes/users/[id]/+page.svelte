<script lang="ts">
  import ApprovalDialog from "$lib/components/dialogs/ApprovalDialog.svelte";
  import AssetCard from "$lib/components/assets/AssetCard.svelte";
  import SponsorButton from "$lib/components/users/SponsorButton.svelte";
  import UserCard from "$lib/components/users/UserCard.svelte";
  import Separator from "$shadcn/components/ui/separator/separator.svelte";
  import Markdown from "$lib/components/generic/Markdown.svelte";

  const { data: _internal } = $props();
  const { pageData, trpc } = $derived(_internal);
  const user = $derived(pageData.user);
  const assets = $derived(pageData.assets.assets);
  let dialog = $state<ApprovalDialog>();

  // #region Edit User
  let editDisplayName = $state("");
  let editBio = $state("");
  // #endregion
</script>

<div class="flex flex-col items-center mx-4">
  <div class="flex flex-col md:flex-row gap-4 w-full">
    <UserCard {user} class="md:min-w-92" />
    <div class="flex flex-row bg-accent p-4 rounded-lg w-full">
      <Markdown bind:markdown={user.bio} class="text-base" />
      {#if user.userPlatforms?.length || 0 > 0}
        <Separator orientation="vertical" class="mx-4" />
        <div class="flex flex-col w-82">
          <div class="flex flex-row flex-wrap gap-2">
            {#each user.userPlatforms as sponsorUrl}
              <SponsorButton class="w-full" type={sponsorUrl.platform} url={sponsorUrl.url} />
            {/each}
          </div>
        </div>
      {/if}
    </div>
  </div>
  <Separator class="my-4 w-full" />
  <div class="mt-4 flex flex-row flex-wrap justify-evenly gap-8">
    {#each assets as asset}
      <AssetCard {asset} size="large" approvalDialog={dialog} />
    {:else}
      <p class="text-muted-foreground">No assets found for this user.</p>
    {/each}
  </div>
</div>

<ApprovalDialog bind:this={dialog} />