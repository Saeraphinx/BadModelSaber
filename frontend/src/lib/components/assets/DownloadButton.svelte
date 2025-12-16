<script lang="ts">
  import { Button, type ButtonProps } from "$shadcn/components/ui/button";
  import * as Dialog from "$shadcn/components/ui/dialog";
  import { onMount, type Snippet } from "svelte";
  import type { ClassValue } from "svelte/elements";

  let {
    href,
    shouldShowWarning,
    class: _class,
    children,
    ...restProps
  }: {
    href: string;
    shouldShowWarning?: boolean;
    class?: ClassValue;
    children?: Snippet;
  } & ButtonProps = $props();

  let dialogVisible = $state(false);
  onMount(() => {
    if (localStorage.getItem("suppressUnverifiedDownloadWarning") === "true") {
      shouldShowWarning = false;
    }
  });
</script>

<Button
  href={shouldShowWarning ? undefined : href}
  variant="default"
  class={_class}
  onclick={(e) => {
    if (shouldShowWarning) {
        e.preventDefault();
        dialogVisible = true;
    }
  }}
  {...restProps}>
  {#if children}
    {@render children()}
  {:else}
    Download
  {/if}
</Button>

{#if dialogVisible}
    {@render showDialog()}
{/if}

{#snippet showDialog()}
  <Dialog.Root bind:open={dialogVisible}>
    <Dialog.Content class="">
      <Dialog.Header>
        <Dialog.Title>Download unverified asset?</Dialog.Title>
      </Dialog.Header>
      <p class="text-md">
        This asset has <b>not</b> been verified by the ModelSaber team. It might contain malware or cause issues with your game.<br><span class="text-orange-400">Use at your own risk!</span>
      </p>
      <p class="text-sm text-muted-foreground">If you'd like to never see this warning again, please click the "Don't show again" button </p>
      <Dialog.Footer>
        <Button variant="ghost" onclick={() => {
          localStorage.setItem("suppressUnverifiedDownloadWarning", "true");
          dialogVisible = false;
          shouldShowWarning = false;
        }}>Don't show again</Button>
        <Button variant="outline" onclick={() => (dialogVisible = false)}>Cancel</Button>
        <Button href={href} onclick={() => (dialogVisible = false)}>Download Once</Button>
      </Dialog.Footer>
    </Dialog.Content>
  </Dialog.Root>
{/snippet}
