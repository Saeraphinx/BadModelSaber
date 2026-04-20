<script lang="ts">
  import { m } from "$lib/paraglide/messages";
  import { Button, type ButtonProps } from "$shadcn/components/ui/button";
  import * as Dialog from "$shadcn/components/ui/dialog";
  import { onMount, type Snippet } from "svelte";
  import type { ClassValue } from "svelte/elements";
  import { Status } from "$lib/scripts/api/DBTypes";

  let {
    href,
    downloadType,
    status,
    class: _class,
    children,
    ...restProps
  }: {
    href: string;
    downloadType: "asset" | "mod";
    status: Status;
    class?: ClassValue;
    children?: Snippet;
  } & ButtonProps = $props();

  let dialogVisible = $state(false);
  let dialogToUse: `asset` | `unverifiedmod` | `pendingmod` | null = $derived.by(() => {
    if (downloadType === `asset` && status === `unverified`) {
      return `asset`;
    } else if (downloadType === `mod` && status === `unverified`) {
      return `unverifiedmod`;
    } else if (downloadType === `mod` && status === `pending`) {
      return `pendingmod`;
    } else {
      return null;
    }
  });
  let showWarning = $state(false);
  onMount(() => {
    if (localStorage.getItem(`suppressUnverifiedDownloadWarning-${downloadType}`) === "true") {
      showWarning = false;
    } else if (status === Status.Verified) {
      showWarning = false;
    } else {
      showWarning = true;
    }

    return () => {
      clearInterval(countdownInterval);
    };
  });

  let dlCountdown = $state(5);
  let ignoreCountdown = $state(10);
  let countdownInterval: NodeJS.Timeout;
  function startCountdown() {
    countdownInterval = setInterval(() => {
      if (dlCountdown > 0) {
        dlCountdown -= 1;
      }
      if (ignoreCountdown > 0) {
        ignoreCountdown -= 1;
      }
    }, 1000);
  }
</script>

<Button
  href={showWarning ? undefined : href}
  variant="default"
  class={_class}
  onclick={(e) => {
    if (showWarning) {
        e.preventDefault();
        startCountdown();
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
        {#if dialogToUse === `asset`}
          <Dialog.Title>{m["dialogs.downloadDialog.assetTitle"]()}</Dialog.Title>
        {:else if dialogToUse === `unverifiedmod`}
          <Dialog.Title>{m["dialogs.downloadDialog.unverifiedModTitle"]()}</Dialog.Title>
        {:else if dialogToUse === `pendingmod`}
          <Dialog.Title>{m["dialogs.downloadDialog.pendingModTitle"]()}</Dialog.Title>
        {/if}
      </Dialog.Header>
      {#if dialogToUse === `asset`}
        <p class="text-md">{@html m["dialogs.downloadDialog.assetDescription"]()}</p>
      {:else if dialogToUse === `unverifiedmod`}
        <p class="text-md">{@html m["dialogs.downloadDialog.unverifiedModDescription"]()}</p>
      {:else if dialogToUse === `pendingmod`}
        <p class="text-md">{@html m["dialogs.downloadDialog.pendingModDescription"]()}</p>
      {/if}
      <p class="text-sm text-muted-foreground">{m["dialogs.downloadDialog.neverShowAgain"]()}</p>
      <Dialog.Footer>
        <Button disabled={ignoreCountdown >= 1} variant="ghost" onclick={() => {
          localStorage.setItem(`suppressUnverifiedDownloadWarning-${downloadType}`, "true");
          dialogVisible = false;
          showWarning = false;
        }}>{m["dialogs.dontShowAgain"]()}</Button>
        <Button href={href} variant="outline" disabled={dlCountdown >= 1} onclick={() => (dialogVisible = false)}>{m["common.buttons.download"]()}{dlCountdown >= 1 ? ` (${dlCountdown})` : ``}</Button>
        <Button onclick={() => (dialogVisible = false)}>{m["dialogs.cancel"]()}</Button>
      </Dialog.Footer>
    </Dialog.Content>
  </Dialog.Root>
{/snippet}
