<script lang="ts">
  import { marked } from "marked";
  import DOMPurify from "isomorphic-dompurify";
  import { onMount } from "svelte";
  import type { HTMLAttributes } from "svelte/elements";

  const {
    markdown,
    class: className,
    ...restProps
  }: {
    markdown: string;
  } & HTMLAttributes<HTMLDivElement> = $props();

  let renderedHtml: string = $state("");
  let isRenderable = $derived(DOMPurify.isSupported);

  onMount(async () => {
    renderedHtml = DOMPurify.sanitize(await marked.parse(markdown), { USE_PROFILES: { html: true } });
  })
</script>

<div class={className} {...restProps}>
  {#if isRenderable}
    {@html renderedHtml}
  {:else}
    <p class="text-red-500">Markdown rendering is not supported in your browser.</p> 
  {/if}
</div>