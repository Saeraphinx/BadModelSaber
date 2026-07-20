<script lang="ts">
  import { AssetFileFormat, Tags } from "$lib/scripts/from_backend/DBExtras";
  import { getTagData } from "$lib/scripts/utils/tags";
  import { Badge } from "$shadcn/components/ui/badge";
  import { cn } from "$shadcn/utils";
  import { type Snippet } from "svelte";
  import type { ClassValue } from "svelte/elements";

  let { 
    tag,
    variant = "secondary",
    class: className,
    children,
    ...restProps
  } : { 
    tag: Tags, 
    variant?: "default" | "secondary" | "destructive" | "outline" | undefined, 
    class?: ClassValue, 
    children?: Snippet, 
    restProps?: HTMLDivElement 
  } = $props();

  let tagData = $derived.by(() => getTagData(tag, AssetFileFormat.Avatar_Avatar));
</script>

<div class={cn(`flex items-center justify-center p-0.5 rounded-lg`, tagData.outlineColor)}>
  <Badge {variant} class={className} {...restProps}>
    {tagData.translatedTag}
    {#if children}
      {@render children()}
    {/if}
  </Badge>
</div>