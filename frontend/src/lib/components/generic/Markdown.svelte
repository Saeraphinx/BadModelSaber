<script lang="ts">
  import { Marked } from "marked";
  import DOMPurify from "isomorphic-dompurify";
  import { onMount } from "svelte";
  import type { HTMLAttributes } from "svelte/elements";
  import hljs from "highlight.js";
  import "highlight.js/styles/github-dark.min.css";
  import { markedHighlight } from "marked-highlight";
  import { cn } from "$shadcn/utils";

  const {
    markdown = $bindable(""),
    class: className,
    ...restProps
  }: {
    markdown: string | null;
  } & HTMLAttributes<HTMLDivElement> = $props();

  let renderedHtml: string = $state("");
  let isRenderable = $derived(DOMPurify.isSupported);

  const marked = new Marked(
    markedHighlight({
      langPrefix: "font-mono hljs language-",
      highlight(code, lang) {
        const language = hljs.getLanguage(lang) ? lang : "plaintext";
        return hljs.highlight(code, { language }).value;
      },
    }),
  );

  $effect(() => {
    (async () => {
      renderedHtml = DOMPurify.sanitize(await marked.parse(markdown ?? ``), { 
        USE_PROFILES: { html: true },
      });
    })();
  });
</script>

<!-- https://github.com/tailwindlabs/tailwindcss-typography -->
<div class={cn(`wrap-break-words min-w-0 max-w-full`, `prose prose-invert prose-neutral `, `prose-h1:mb-2 prose-h1:pb-1 prose-h1:border-b-2 `, `prose-h2:pb-1 prose-h2:border-b-2 prose-h2:mb-2`, `prose-code:content-[""]`, className)} {...restProps}>
  {#if isRenderable}
    {@html renderedHtml}
  {:else}
    <p class="text-red-500 font-mono">Markdown rendering is not supported in your browser.</p>
  {/if}
</div>

<style>
  div :global(pre) {
    overflow-x: auto;
    max-width: 100%;
  }
</style>
