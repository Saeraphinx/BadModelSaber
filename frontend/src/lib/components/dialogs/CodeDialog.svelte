<script lang="ts">
  import * as Dialog from "$shadcn/components/ui/dialog";
  import { Button } from "../../shadcn/components/ui/button";
  import Markdown from "../generic/Markdown.svelte";

  let open = $state(false);
  let markdown = $state("");
  let showCopy = $state(false);
  let codeUrlhref = $state<string | null>(null);

  export function showDialog(string: string, language: string = "cs", allowCopy: boolean = false, codeUrl: string | null = null) {
    if (language === `json`) {
      try {
        string = JSON.stringify(JSON.parse(string), null, 2);
      } catch (e) {
        // ignore
      }
    }
    markdown = `\`\`\`${language}\n${string}\n\`\`\``;
    showCopy = allowCopy;
    codeUrlhref = codeUrl;
    open = true;
  }
</script>

<Dialog.Root bind:open={open}>
  <Dialog.Content class="w-[90%] min-w-[90%]">
    <Dialog.Header class="min-w-0">
      <Dialog.Title>Code Viewer</Dialog.Title>
    </Dialog.Header>
      <div class="max-h-[70vh] overflow-y-scroll overflow-x-scroll mt-4">
        <Markdown markdown={markdown} enableCodeBg={false}/>
      </div>
      <div class="flex flex-row justify-end-safe gap-2">
        {#if showCopy}
            {#if codeUrlhref}
              <Button variant="outline" href={codeUrlhref} target="_blank" rel="noopener noreferrer">
                View Original
              </Button>
            {/if}
            <Button onclick={() => navigator.clipboard.writeText(markdown)}>
              Copy to Clipboard
            </Button>
        {/if}
      </div>
  </Dialog.Content>
</Dialog.Root>