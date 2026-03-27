<script lang="ts">
  import { m } from "$lib/paraglide/messages";
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
    {m["common.buttons.download"]()}
  {/if}
</Button>

{#if dialogVisible}
    {@render showDialog()}
{/if}

{#snippet showDialog()}
  <Dialog.Root bind:open={dialogVisible}>
    <Dialog.Content class="">
      <Dialog.Header>
        <Dialog.Title>{m["dialogs.downloadDialog.title"]()}</Dialog.Title>
      </Dialog.Header>
      <p class="text-md">{m["dialogs.downloadDialog.description"]()}</p>
      <p class="text-sm text-muted-foreground">{m["dialogs.downloadDialog.neverShowAgain"]()}</p>
      <Dialog.Footer>
        <Button variant="ghost" onclick={() => {
          localStorage.setItem("suppressUnverifiedDownloadWarning", "true");
          dialogVisible = false;
          shouldShowWarning = false;
        }}>{m["dialogs.dontShowAgain"]()}</Button>
        <Button variant="outline" onclick={() => (dialogVisible = false)}>{m["dialogs.cancel"]()}</Button>
        <Button href={href} onclick={() => (dialogVisible = false)}>{m["dialogs.downloadDialog.proceed"]()}</Button>
      </Dialog.Footer>
    </Dialog.Content>
  </Dialog.Root>
{/snippet}
