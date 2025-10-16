<script lang="ts">
  import { assets } from "$app/paths";
  import { Status, Tags, type AssetPublicAPIv3, type UserPublicAPIv3 } from "$lib/scripts/api/DBTypes";
  import { Badge } from "$shadcn/components/ui/badge";
  import Button from "$shadcn/components/ui/button/button.svelte";
  import { BadgeAlert, BadgeCheck, BadgeX, Download, DownloadCloud, InfoIcon } from "@lucide/svelte";
  import ApprovalDialog from "./ApprovalDialog.svelte";
  import { getAssetThumbnailUrl, getAssetUrl } from "$lib/scripts/utils/api";
  import type { ClassValue } from "svelte/elements";
  import { generateOneClickUrl } from "$lib/scripts/utils/oneclick";
  import { invalidate } from "$app/navigation";
  import { page } from "$app/state";
  import { cn } from "$shadcn/utils";

  let props: {
    asset: AssetPublicAPIv3;
    size?: "linked" | "normal" | "large";
    approvalDialog?: ApprovalDialog;
    alwaysShowHover?: boolean;
  } = $props();

  let sizeClasses: {
    size: ClassValue;
    headerSize: ClassValue;
  } = $derived.by(() => {
    switch (props.size) {
      case "linked":
        return {
          size: "w- h-24",
          headerSize: "text-base",
        };
      default:
      case "normal":
        return {
          size: "w-48 h-48",
          headerSize: "text-lg"
        };
      case "large":
        return {
          size: "w-64 h-64",
          headerSize: "text-xl"
        };
    }
  });
  let downloadUrl = getAssetUrl(`${props.asset.fileHash}.${props.asset.type.split("_")[1].toLowerCase()}`);
  let oneClickUrl = generateOneClickUrl(props.asset);
</script>

<div class="relative {sizeClasses.size}">
  <!-- Image -->
  <div class="overflow-hidden rounded-2xl mb-4">
    <img src={getAssetThumbnailUrl(props.asset.icons[0])} alt={`Icon for ${props.asset.name}`} class="{sizeClasses.size} rounded-2xl {props.asset.tags.includes(Tags.NSFW) ? `blur-xl` : ``}" />
  </div>

  <!-- Card Overlay -->

  <div
    class={cn("absolute top-0 left-0 w-full h-full focus:opacity-100 hover:opacity-100 transition-opacity duration-300", props.alwaysShowHover ? `opacity-100` : `opacity-0`)}>
    <!-- Title Banner -->
    <div class="absolute top-0 left-0 bg-white/80 dark:bg-gray-800/80 backdrop-blur-xs w-full rounded-t-2xl">
      <div class="p-2 pl-4 flex flex-col">
        <a href="/assets/{props.asset.id}" class="{sizeClasses.headerSize} dark:hover:text-blue-300 hover:text-blue-700 transition-colors duration-300" onclick={() => invalidate(page.url)}>{props.asset.name}</a>
        <a href="/users/{props.asset.uploaderId}" class="text-sm text-gray-500 dark:text-gray-400">{props.asset.uploader?.displayName}</a>
      </div>
      <!-- <div class="flex flex-row flex-wrap pb-2 pl-4 gap-1">
        
      </div> -->
    </div>

    <!-- Buttons -->
    <div class="absolute flex bottom-2 right-2 backdrop-blur-sm bg-white/40 dark:bg-gray-800/20 rounded-md text-black dark:text-white transition-all duration-300">
      {#if props.approvalDialog}
        <Button variant="ghost" size="icon" title="Update Status" onclick={() => props.approvalDialog?.showDialog(props.asset.id, props.asset.name)}>
          <BadgeAlert />
        </Button>
      {/if}
      <Button variant="ghost" data-sveltekit-reload href="/assets/{props.asset.id}" size="icon" title="Goto Asset Page">
        <InfoIcon />
      </Button>
      <Button variant="ghost" href={downloadUrl} size="icon" title="Download">
        <Download />
      </Button>
      <Button variant="ghost" href={oneClickUrl} size="icon" title="OneClick Install">
        <DownloadCloud />
      </Button>
    </div>
  </div>

  <!-- Status -->
  <div title="{props.asset.status}" class="absolute top-0 right-0 p-3">
    {#if props.asset.status === Status.Approved}
      <BadgeCheck class="text-green-400" />
    {:else if props.asset.status === Status.Pending}
      <BadgeAlert class="text-yellow-400" />
    {:else}
      <BadgeX class="text-red-400" />
    {/if}
  </div>
</div>
