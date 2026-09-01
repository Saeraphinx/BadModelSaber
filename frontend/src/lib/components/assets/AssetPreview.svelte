<script lang="ts">
  import { m } from "$lib/paraglide/messages";
  import { AssetFileFormat, type AssetApiV3 } from "$lib/scripts/from_backend/DBExtras";
  import { getAssetDownloadUrl } from "$lib/scripts/utils/api";
  import Button from "$shadcn/components/ui/button/button.svelte";
    
  let props : {
    asset: AssetApiV3;
  } = $props();

  let isPreviewLoaded = $state(false);
  let previewType = $derived.by(() => {
    // Determine preview type based on asset type
    switch (props.asset.type) {
      case AssetFileFormat.Banner_Png:
        return "image";
      case AssetFileFormat.Sound_Mp3:
      case AssetFileFormat.Sound_Ogg:
        return "audio";
      case AssetFileFormat.HSVConfig_JSON:
        return "hsv";
      case AssetFileFormat.Camera2Config_JSON:
      case AssetFileFormat.ChromaEnv_JSON:
      case AssetFileFormat.CountersPlusConfig_JSON:
        return "json";
      default:
        return "none";
    }
  });

  let downloadUrl = $derived.by(() => getAssetDownloadUrl(props.asset));
  async function fetchPreviewData() {
    if (previewType === "json" || previewType === "hsv") {
      return await fetch(downloadUrl)
        .then(res => res.text())
        .then(data => {
          isPreviewLoaded = true;
          return data;
        });
    } else {
      isPreviewLoaded = true;
      return null;
    }
  }
</script>

<style>
  li {
    margin-left: 3em;
    font-family: var(--font-mono);
  }
  li::marker {
    color: var(--muted-foreground);
    margin: 0 0.5em 0 0;
  }
</style>

<div class="w-full h-full flex {isPreviewLoaded ? `flex-col` : `flex-row p-2`} gap-2 items-center justify-center">
  {#if previewType === "image"}
    <img src={getAssetDownloadUrl(props.asset)} alt="Asset Preview" class="max-w-full max-h-full object-contain" />
  {:else if previewType === "audio"}
    <audio controls class="w-full">
      <source src={getAssetDownloadUrl(props.asset)} />
      {m[`assets.preview.noAudioSupport`]()}
    </audio>
  {:else if previewType === "json" || previewType === "hsv"}
    {#if previewType === "hsv"}
      <Button variant="outline" href={`https://hsv-preview.netlify.app/?url=${encodeURIComponent(downloadUrl)}`} target="_blank">
        {m[`assets.preview.openHSVPreviewer`]()}
      </Button>
    {/if}
    {#if isPreviewLoaded}
      {#await fetchPreviewData()}
        {m[`assets.preview.waitingForData`]()}
      {:then data} 
        <p class="sr-only">{@html m[`assets.preview.textOnlySr`]({ downloadUrl })}</p>
        <ol class="text-sm max-h-96 w-full overflow-auto p-2 bg-muted rounded-2xl whitespace-pre font-mono list-decimal" aria-hidden="true">
          {#each data?.split(`\n`) as line}
            <li>{line}</li>
          {/each} 
        </ol>
      {:catch error}
        <p class="text-red-500">{m[`assets.preview.failedToLoadError`]({ error: error.message })}</p>
      {/await}
    {:else}
      <Button variant="outline" onclick={() => isPreviewLoaded = true}>
        {m[`assets.preview.downloadAndLoadPreview`]()}
      </Button>
    {/if}
  {:else}
    <p class="text-muted-foreground">{m[`assets.preview.noPreviewAvailable`]()}</p>
  {/if}
</div>