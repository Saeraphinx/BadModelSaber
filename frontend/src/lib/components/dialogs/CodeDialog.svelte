<script lang="ts">
  import * as Dialog from "$shadcn/components/ui/dialog";
  import Markdown from "../generic/Markdown.svelte";

  let open = $state(false);
  let markdown = $state("");

  export function showDialog(string: string, language: string = "cs") {
    if (language === `json`) {
      try {
        string = JSON.stringify(JSON.parse(string), null, 2);
      } catch (e) {
        // ignore
      }
    }
    markdown = `\`\`\`${language}\n${string}\n\`\`\``;
    open = true;
  }
</script>

<Dialog.Root bind:open={open}>
  <Dialog.Content class="w-[90%] min-w-[90%]">
    <Dialog.Header class="min-w-0 overflow-scroll">
      <Dialog.Title>Code Viewer</Dialog.Title>
      <div class="max-h-[70vh] overflow-y-auto overflow-x-auto mt-4">
        <Markdown markdown={markdown} />
      </div>
    </Dialog.Header>
  </Dialog.Content>
</Dialog.Root>