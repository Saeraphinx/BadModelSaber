<script lang="ts">
  import * as Dialog from "$shadcn/components/ui/dialog";
  import { Button } from "$shadcn/components/ui/button";
  import Markdown from "../generic/Markdown.svelte";
  import { trpc } from "../../scripts/utils/api";
  import { toast } from "svelte-sonner";

  let open = $state(false);
  let markdown = $state("");
  let showCopy = $state(false);
  let codeUrlhref = $state<string | null>(null);
  let decompileId = $state<number | undefined>(undefined);
  let shouldDisable = $state(false);

  async function startDecompile() {
    if (decompileId == undefined) {
      return;
    }

    console.log(`Starting decompile for ID: ${decompileId}`);
    trpc.internal.admin.approval.startDecompileVersion.mutate({ id: decompileId }).then(() => {
      toast.success("Decompile started.");
    });
  }

  export async function showDialog(string: string, language: string = "cs", allowCopy: boolean = false, codeUrl: string | null = null, startDecompileId?: number) {
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
    decompileId = startDecompileId;
    shouldDisable = decompileId === undefined || (!string.startsWith(`<`) && !string.startsWith(`Failed to fetch code`));
    open = true;
  }
</script>

<Dialog.Root bind:open={open}>
  <Dialog.Content class="w-[90%] min-w-[90%]">
    <Dialog.Header class="min-w-0">
      <Dialog.Title>Code Viewer</Dialog.Title>
    </Dialog.Header>
      <div class="max-h-[70vh] overflow-y-scroll overflow-x-scroll mt-4 bg-black/50 rounded-lg">
        <Markdown markdown={markdown} enableCodeBg={false}/>
      </div>
      <div class="flex flex-row justify-end-safe gap-2">
        {#if decompileId !== undefined}
          <Button variant="outline" onclick={startDecompile} disabled={shouldDisable}>
              Start Decompile
          </Button>
        {/if}
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