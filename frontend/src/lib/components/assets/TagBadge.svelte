<script lang="ts">
  import { AssetFileFormat, Tags } from "$lib/scripts/api/DBTypes";
  import { getTagData } from "$lib/scripts/utils/tags";
  import { Badge } from "$shadcn/components/ui/badge";
  import { cn } from "$shadcn/utils";
  import { onMount, type Snippet } from "svelte";
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

  let intClass: ClassValue = $derived.by(() => {
    return getTagData(tag, AssetFileFormat.Banner_Png).outlineColor; 
  });
</script>

<div class="flex items-center justify-center p-0.5 rounded-lg {intClass}">
  <Badge {variant} class={className} {...restProps}>
    {tag}
    {#if children}
      {@render children()}
    {/if}
  </Badge>
</div>

