<script lang="ts">
    import { SponsorType } from "$lib/scripts/api/DBTypes";
    import { Button } from "$shadcn/components/ui/button";

  let { 
    type,
    url
   } : {
    type: SponsorType;
    url: string;
   } = $props();
</script>

<Button variant="outline" class="mt-4" href={url} target="_blank">
  {#if type === SponsorType.GitHub}
    <img src="/github.svg" alt="GitHub logo" class="w-5 h-5 mr-2" />
    GitHub
  {:else if type === SponsorType.KoFi}
    <img src="/kofi.svg" alt="Ko-fi logo" class="w-5 h-5 mr-2" />
    Ko-fi
  {:else if type === SponsorType.Patreon}
    <img src="/patreon.svg" alt="Patreon logo" class="w-5 h-5 mr-2" />
    Patreon
  {:else}
    Unknown Sponsor
  {/if}
</Button>