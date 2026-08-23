<script lang="ts">
    import { PlatformType } from "$lib/scripts/from_backend/DBExtras";
    import { Button } from "$shadcn/components/ui/button";
  import type { HTMLAttributes } from "svelte/elements";

  let { 
    type,
    username,
    class: className,
    ...restProps
   } : {
    type: PlatformType | `profile_discord` | `profile_github`;
    username: string;
  } & HTMLAttributes<HTMLElement> = $props();

    let url = $derived.by(() => {
      switch (type) {
        case PlatformType.GitHub:
          return `https://github.com/sponsors/${username}`;
        case PlatformType.KoFi:
          return `https://ko-fi.com/${username}`;
        case PlatformType.Patreon:
          return `https://www.patreon.com/${username}`;
        case `profile_discord`:
          return `discord://discord.com/users/${username}`;
        case `profile_github`:
          return `https://github.com/${username}`;
        default:
          return `#`;
      }
    });
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