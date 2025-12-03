<script lang="ts">
  import { AssetFileFormat, type AssetPublicAPIv3 } from "$lib/scripts/api/DBTypes";
  import { getAssetDownloadUrl } from "$lib/scripts/utils/api";
  import Button from "$shadcn/components/ui/button/button.svelte";
    
  let props : {
    asset: AssetPublicAPIv3;
  } = $props();

  let isPreviewLoaded = $state(false);
  let previewType = $derived.by(() => {
    // Determine preview type based on asset type
    switch (props.asset.type) {
      case AssetFileFormat.Banner_Png:
        isPreviewLoaded = true;
        return "image";
      case AssetFileFormat.Sound_Mp3:
      case AssetFileFormat.Sound_Ogg:
        isPreviewLoaded = true;
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
      Your browser does not support the audio element.
    </audio>
  {:else if previewType === "json" || previewType === "hsv"}
    {#if previewType === "hsv"}
      <Button variant="outline" href={`https://hsv-preview.netlify.app/?url=${encodeURIComponent(downloadUrl)}`} target="_blank">
        Open HitScoreVisualizer Preview
      </Button>
    {/if}
    {#if isPreviewLoaded}
      {#await fetchPreviewData()}
        Waiting for preview data...
      {:then data} 
        <p class="sr-only">This preview only shows the content within the file. If you wish to read it, please <a href={downloadUrl}>download the file</a> and open it with your system.</p>
        <ol class="text-sm max-h-96 w-full overflow-auto p-2 bg-muted rounded-2xl whitespace-pre font-mono list-decimal" aria-hidden="true">
          {#each data?.split(`\n`) as line}
            <li>{line}</li>
          {/each} 
        </ol>
      {:catch error}
        <p class="text-red-500">Failed to load preview data: {error.message}</p>
      {/await}
    {:else}
      <Button variant="outline" onclick={() => isPreviewLoaded = true}>
        Download & Load Preview
      </Button>
    {/if}
  {:else}
    <p class="text-muted-foreground">No preview available for this asset type.</p>
  {/if}
</div>