<script lang="ts">
  import { Status, Tags, type AssetApiV3, type ProjectApiV3 } from "$lib/scripts/from_backend/DBExtras";
  import Button from "$shadcn/components/ui/button/button.svelte";
  import { BadgeAlert, BadgeCheck, BadgeX, Download, DownloadCloud, InfoIcon, CircleHelp } from "@lucide/svelte";
  import ApprovalDialog from "../dialogs/ApprovalDialog.svelte";
  import { getAssetDownloadUrl, getOneClickUrl, getThumbnailUrl } from "$lib/scripts/utils/api";
  import type { ClassValue } from "svelte/elements";
  import { invalidate, goto } from "$app/navigation";
  import { page } from "$app/state";
  import { cn } from "$shadcn/utils";
  import StatusHoverCard from "../generic/StatusHoverCard.svelte";
  import { m } from "$lib/paraglide/messages";

  let props: {
    project: ProjectApiV3;
    size?: "linked" | "normal" | "large" | "small";
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
          size: "w-24 h-24",
          headerSize: "text-base",
        };
      default:
      case "normal":
        return {
          size: "w-48 h-48",
          headerSize: "text-lg",
        };
      case "large":
        return {
          size: "w-64 h-64",
          headerSize: "text-xl",
        };
      case "small":
        return {
          size: "w-32 h-32",
          headerSize: "text-base",
        };
    }
  });
</script>

<div class="relative {sizeClasses.size}">
  <!-- Image -->
  <a href="/mods/{props.project.id}">
    <div class="overflow-hidden rounded-2xl mb-4">
      <img
        src={props.project.iconFileUrl}
        alt={`Icon for ${props.project.name}`}
        class="{sizeClasses.size} rounded-2xl"
        role="presentation"
      />
    </div>
  </a>

  <!-- Card Overlay -->
  {#if props.size !== "linked" && props.size !== "small"}
      <div class={cn("absolute top-0 left-0 w-full h-full focus:opacity-100 active:opacity-100 hover:opacity-100 transition-opacity group duration-300", props.alwaysShowHover ? `opacity-100` : `opacity-0`)}
        role="presentation"
        onclick={(e) => {
          let element = e.target as HTMLElement;
          if (element.closest("a") || element.closest(`button`)) return; // Don't trigger if clicking on a link
          goto(`/mods/${props.project.id}`)
        }}>
        <!-- Title Banner -->
        <div class="absolute top-0 left-0 bg-gray-800/80 transition-[backdrop-filter] backdrop-blur-none group-hover:backdrop-blur-sm duration-300 w-full rounded-t-2xl">
          <div class="p-2 pl-4 flex flex-col">
            <a href="/mods/{props.project.id}" class="{sizeClasses.headerSize} hover:text-blue-300 transition-colors duration-300" onclick={() => invalidate(page.url)}>{props.project.name}</a>
            {#each props.project.authors as author}
              <a href="/users/{author.id}" class="text-sm text-gray-400">{author.displayName}</a>
            {/each}
          </div>
          <!-- <div class="flex flex-row flex-wrap pb-2 pl-4 gap-1">
      
          </div> -->
        </div>
        <!-- Buttons -->
        <div class="absolute flex bottom-2 right-2 transition-[backdrop-filter] backdrop-blur-none hover:backdrop-blur-md duration-300 bg-gray-800/20 rounded-md text-white">
          <Button variant="ghost" data-sveltekit-reload href="/mods/{props.project.id}" size="icon" title={m[`common.hover.goToMod`]()}>
            <InfoIcon />
          </Button>
        </div>
      </div>
  {/if}

  <!-- Status -->
  <div class="absolute top-0 right-0 p-3">
    {#if props.project.status === Status.Public}
      <StatusHoverCard status={props.project.status} type="mod">
        <BadgeCheck class="text-green-400" />
      </StatusHoverCard>
    {:else}
      <BadgeX class="text-red-400" />
    {/if}
  </div>
</div>
