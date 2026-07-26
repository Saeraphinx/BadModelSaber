<script lang="ts">
  import { Marked } from "marked";
  import DOMPurify from "isomorphic-dompurify";
  import type { HTMLAttributes } from "svelte/elements";
  import hljs from "highlight.js";
  import Alert from "marked-alert";
  import "highlight.js/styles/github-dark.min.css";
  import { markedHighlight } from "marked-highlight";
  import { cn } from "$shadcn/utils";

  const {
    markdown = $bindable(""),
    enableCodeBg = true,
    class: className,
    ...restProps
  }: {
    markdown: string | null;
    enableCodeBg?: boolean;
  } & HTMLAttributes<HTMLDivElement> = $props();

  let renderedHtml: string = $state("");
  let isRenderable = $derived(DOMPurify.isSupported);
  const marked = new Marked(
    Alert({
      className: "no-prose markdown-alert",
      variants: [
        {
          type: "note",
          icon: "",
        },
        {
          type: "tip",
          icon: "",
        },
        {
          type: "important",
          icon: "",
        },
        {
          type: "warning",
          icon: "",
        },
        {
          type: "caution",
          icon: "",
        },
      ],
    }),
    markedHighlight({
      langPrefix: "font-mono hljs language-",
      highlight(code, lang) {
        const language = hljs.getLanguage(lang) ? lang : "plaintext";
        return hljs.highlight(code, { language }).value;
      },
    }),
  );

  $effect(() => {
    DOMPurify.addHook("afterSanitizeAttributes", function (node) {
      if (node.tagName === "A" && node.hasAttribute("href")) {
        const href = node.getAttribute("href");
        if (!href) {
          node.removeAttribute("href");
          return;
        }
        // If it doesn't start with https://, remove it
        if (!/^https:\/\//i.test(href)) {
          node.removeAttribute("href");
        }
        node.setAttribute("rel", "noopener noreferrer");
        node.setAttribute("target", "_blank");
      }

      // Check <img> tags for relative src
      if (node.tagName === "IMG" && node.hasAttribute("src")) {
        const src = node.getAttribute("src");
        if (!src) {
          node.removeAttribute("src");
          return;
        }
        // If it doesn't start with https://, remove it
        if (!/^https:\/\//i.test(src)) {
          node.removeAttribute("src");
        }
      }
    });

    (async () => {
      renderedHtml = DOMPurify.sanitize(await marked.parse(markdown ?? ``), {
        USE_PROFILES: { html: true, svg: true },
      });
    })();

    return () => {
      DOMPurify.removeAllHooks();
    };
  });
</script>

<!-- https://github.com/tailwindlabs/tailwindcss-typography -->
<div
  class={cn(
    `wrap-break-words min-w-0 max-w-full`,
    `prose prose-invert prose-neutral`,
    `prose-h1:mb-2 prose-h1:pb-1 prose-h1:border-b-2 `,
    `prose-h2:pb-1 prose-h2:border-b-2 prose-h2:mb-2`,
    `prose-code:before:content-[""]! prose-code:after:content-[""]! prose-code:mx-1.5`,
    `[&_.markdown-alert]:flex [&_.markdown-alert]:items-start [&_.markdown-alert]:gap-2 [&_.markdown-alert]:rounded [&_.markdown-alert]:border-2 [&_.markdown-alert]:p-4`,
    `[&_.markdown-alert-title]:font-bold [&_.markdown-alert-title]:mb-1 [&_.markdown-alert-title]:after:content-[":"]`,
    `[&_.markdown-alert-note]:bg-blue-800/50 [&_.markdown-alert-note]:border-blue-500/50 [&_.markdown-alert-note]:text-blue-100`,
    `[&_.markdown-alert-tip]:bg-green-800/50 [&_.markdown-alert-tip]:border-green-500/50 [&_.markdown-alert-tip]:text-green-100`,
    `[&_.markdown-alert-important]:bg-purple-800/50 [&_.markdown-alert-important]:border-purple-500/50 [&_.markdown-alert-important]:text-purple-100`,
    `[&_.markdown-alert-warning]:bg-orange-800 [&_.markdown-alert-warning]:border-yellow-500 [&_.markdown-alert-warning]:text-yellow-100`,
    `[&_.markdown-alert-caution]:bg-red-800 [&_.markdown-alert-caution]:border-red-500 [&_.markdown-alert-caution]:text-red-100`,
    enableCodeBg ? `` : `[&_.hljs]:bg-transparent! prose-pre:bg-black/0! [&_.hljs]:overflow-x-visible! [&_.hljs]:p-0! prose-pre:overflow-x-visible! prose-pre:w-full!`,
    className,
  )}
  {...restProps}>
  {#if isRenderable}
    {@html renderedHtml}
  {:else}
    <p class="text-red-500 font-mono">Markdown rendering is not supported in your browser.</p>
  {/if}
</div>
