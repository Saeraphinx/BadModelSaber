<script lang="ts">
  import ApprovalDialog from "$lib/components/assets/ApprovalDialog.svelte";
  import AssetCard from "$lib/components/assets/AssetCard.svelte";
  import UserCard from "$lib/components/users/UserCard.svelte";
  import Separator from "$shadcn/components/ui/separator/separator.svelte";

  const { data } = $props();
  const user = data.pageData.userData;
  const assets = data.pageData.assets || [];
  let dialog = $state<ApprovalDialog>();
</script>

<div class="flex flex-col items-center mx-4">
  <div class="flex flex-col md:flex-row gap-4 w-full">
    <UserCard {user} class="md:min-w-92" />
    <div class="flex flex-col bg-accent p-4 rounded-lg w-full">
      <p class="text-base whitespace-pre-line text-wrap wrap-anywhere">{user.bio}</p>
      <!-- {#if user.sponsorUrl}
        <Button variant="outline" class="mt-4" href={user.sponsorUrl} target="_blank">Patreon</Button>
      {/if} -->
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