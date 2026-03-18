<script lang="ts">
  import ApprovalDialog from "$lib/components/assets/ApprovalDialog.svelte";
  import AssetCard from "$lib/components/assets/AssetCard.svelte";
  import SponsorButton from "$lib/components/users/SponsorButton.svelte";
  import UserCard from "$lib/components/users/UserCard.svelte";
  import Separator from "$shadcn/components/ui/separator/separator.svelte";

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
    <div class="flex flex-col bg-accent p-4 rounded-lg w-full">
      <div class="flex flex-col w-64">
        <div class="flex flex-row flex-wrap gap-2">
          {#each user.userPlatforms as sponsorUrl}
            <SponsorButton type={sponsorUrl.platform} url={sponsorUrl.url} />
          {/each}
        </div>
        <Separator class="my-4 w-full" />
      </div>
      <p class="text-base whitespace-pre-line text-wrap wrap-anywhere">{user.bio}</p>
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