<script lang="ts">
    import { PlatformType } from "$lib/scripts/from_backend/DBExtras";
    import { Button } from "$shadcn/components/ui/button";
  import type { HTMLAttributes } from "svelte/elements";

  let { 
    type,
    url,
    class: className,
    ...restProps
   } : {
    type: PlatformType | `profile_discord` | `profile_github`;
    url: string;
  } & HTMLAttributes<HTMLElement> = $props();
</script>

<Button class={className} variant="outline" href={url} target={type === `profile_discord` ? `_self` : `_blank`} {...restProps}>
  {#if type === PlatformType.GitHub}
    <img src="/github-light.svg" alt="GitHub logo" class="w-5 h-5" />
    <p>GitHub Sponsor</p>
  {:else if type === PlatformType.KoFi}
    <img src="/ko-fi.svg" alt="Ko-fi logo" class="w-5 h-5" />
    <p>Ko-fi</p>
  {:else if type === PlatformType.Patreon}
    <img src="/patreon-light.svg" alt="Patreon logo" class="w-5 h-5" />
    <p>Patreon</p>
  {:else if type === `profile_discord`}
    <img src="/discord-light.svg" alt="Discord logo" class="w-5 h-5" />
    <p>Discord Profile</p>
  {:else if type === `profile_github`}
    <img src="/github-light.svg" alt="GitHub logo" class="w-5 h-5" />
    <p>GitHub Profile</p>
  {:else}
    <p>Unknown Sponsor</p>
  {/if}
</Button>