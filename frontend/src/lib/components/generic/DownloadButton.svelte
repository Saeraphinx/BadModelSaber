<script lang="ts">
  import { i18n } from "$lib/scripts/i18n";

  const { t } = i18n();
  import { Button, type ButtonProps } from "$shadcn/components/ui/button";
  import * as Dialog from "$shadcn/components/ui/dialog";
  import { onMount, type Snippet } from "svelte";
  import type { ClassValue } from "svelte/elements";
  import { Status } from "$lib/scripts/from_backend/DBExtras";

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
  let dialogToUse: `assetNonverified` | `modNonverified` | `modTesting` | null = $derived.by(() => {
    if (downloadType === `asset` && (status === Status.Queue || status === Status.Unverified)) {
      return `assetNonverified`;
    } else if (downloadType === `mod` && (Status.Queue || status === Status.Unverified)) {
      return `modNonverified`;
    } else if (downloadType === `mod` && status === Status.Testing) {
      return `modTesting`;
    } else {
      return null;
    }
  });
  let showWarning = $state(false);
  onMount(() => {
    if (localStorage.getItem(`suppressDownloadWarning-${downloadType}-${status}`) === "true") {
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
    {t(`common.buttons.download`)}
  {/if}
</Button>

{#if dialogVisible}
    {@render showDialog()}
{/if}

{#snippet showDialog()}
  <Dialog.Root bind:open={dialogVisible}>
    <Dialog.Content class="">
      <Dialog.Header>
        {#if dialogToUse === `assetNonverified`}
          <Dialog.Title>{t(`dialogs.downloadDialog.assetTitle`)}</Dialog.Title>
        {:else if dialogToUse === `modNonverified`}
          <Dialog.Title>{t(`dialogs.downloadDialog.nonVerifiedModTitle`)}</Dialog.Title>
        {:else if dialogToUse === `modTesting`}
          <Dialog.Title>{t(`dialogs.downloadDialog.testingModTitle`)}</Dialog.Title>
        {/if}
      </Dialog.Header>
      {#if dialogToUse === `assetNonverified`}
        <p class="text-md">{@html t(`dialogs.downloadDialog.assetDescription`)}</p>
      {:else if dialogToUse === `modNonverified`}
        <p class="text-md">{@html t(`dialogs.downloadDialog.nonVerifiedModDescription`)}</p>
      {:else if dialogToUse === `modTesting`}
        <p class="text-md">{@html t(`dialogs.downloadDialog.testingModDescription`)}</p>
      {/if}
      <p class="text-sm text-muted-foreground">{t(`dialogs.downloadDialog.neverShowAgain`)}</p>
      <Dialog.Footer>
        <Button disabled={ignoreCountdown >= 1} variant="ghost" onclick={() => {
          localStorage.setItem(`suppressUnverifiedDownloadWarning-${downloadType}-${status}`, "true");
          dialogVisible = false;
          showWarning = false;
        }}>{t(`dialogs.dontShowAgain`)}</Button>
        <Button href={href} variant="outline" disabled={dlCountdown >= 1} onclick={() => (dialogVisible = false)}>{t(`common.buttons.download`)}{dlCountdown >= 1 ? ` (${dlCountdown})` : ``}</Button>
        <Button onclick={() => (dialogVisible = false)}>{t(`dialogs.cancel`)}</Button>
      </Dialog.Footer>
    </Dialog.Content>
  </Dialog.Root>
{/snippet}
