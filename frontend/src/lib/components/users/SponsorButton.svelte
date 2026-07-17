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
    type: PlatformType;
    url: string;
  } & HTMLAttributes<HTMLElement> = $props();
</script>

<Button class={className} variant="outline" href={url} target="_blank" {...restProps}>
  {#if type === PlatformType.GitHub}
    <img src="/github.svg" alt="GitHub logo" class="w-5 h-5 mr-2" />
    GitHub
  {:else if type === PlatformType.KoFi}
    <img src="/ko-fi.svg" alt="Ko-fi logo" class="w-5 h-5 mr-2" />
    Ko-fi
  {:else if type === PlatformType.Patreon}
    <img src="/patreon.svg" alt="Patreon logo" class="w-5 h-5 mr-2" />
    Patreon
  {:else}
    Unknown Sponsor
  {/if}
</Button>