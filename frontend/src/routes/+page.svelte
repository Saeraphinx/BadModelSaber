<script lang="ts">
  import AssetCard from "$lib/components/assets/AssetCard.svelte";
  import { Status, UserPermissions, type AssetApiV3 } from "$lib/scripts/api/DBTypes";
  import { trpc } from "$lib/scripts/utils/api";
  import { Button } from "$shadcn/components/ui/button";
  import * as Carousel from "$shadcn/components/ui/carousel";
  import { Skeleton } from "$shadcn/components/ui/skeleton";
  import { onMount } from "svelte";
  import AutoScroll from "embla-carousel-auto-scroll"
  import { ExternalLinkIcon } from "@lucide/svelte";
  import Separator from "$shadcn/components/ui/separator/separator.svelte";
  import { m } from "$lib/paraglide/messages";

  const { data: _internal } = $props();
  const { user, fetch } = $derived(_internal);

  let subtitle: string = $state(m["homepage.subtitle"]());
  let recentlyUploadedVerified: AssetApiV3[] = $state([]);
  onMount(async () => {
    trpc.v3.assets.getFrontPageAssets.query().then((data) => {
      recentlyUploadedVerified = data;
    });

    if (user) {
      fetch("https://cdn.saeraphinx.dev/splashtext").then((res) => res.text()).then((text) => {
        subtitle = text.split("\n")[Math.floor(Math.random() * text.split("\n").length)];
      });
    }
  });
</script>

<div class="flex flex-col align-middle justify-center-safe items-center h-screen-nav min-h-[300px]">
  <img src="/modelsaber-logo-web.svg" alt="ModelSaber Logo" class="h-24 w-24" />
  <h1 class="text-4xl font-bold">{ m["homepage.title"]() }</h1>
  <p class="text-lg text-gray-500">{ subtitle }</p>
  <div>
    <Button class="mt-2" href="/assets">{ m["homepage.browseButton"]()}</Button>
    <Button class="mt-2 ml-2" variant="outline" href="https://bsmg.wiki/models">{m["homepage.wikiButton"]()} <ExternalLinkIcon /></Button>
  </div>
  <Separator class="my-6 mx-[25%]" />
  <div class="max-w-screen">
    <Carousel.Root
      class="w-full"
      opts={{ loop: true }}
      plugins={
        [AutoScroll({
          speed: 1,
          stopOnMouseEnter: true,
          stopOnInteraction: false,
          direction: `backward`,
          playOnInit: true,
          active: true,
          startDelay: 0
        })]
      }>
      <Carousel.Content class="">
        {#if recentlyUploadedVerified.length > 0}
          {#each recentlyUploadedVerified as asset (asset.id)}
            <Carousel.Item class="pl-4 basis-auto">
              <AssetCard {asset} size="large" />
            </Carousel.Item>
          {/each}
        {:else}
          {#each Array(30) as _, index}
            <Carousel.Item class="pl-4 basis-auto">
              <Skeleton class="bg-gray-400/20 w-64 h-64 rounded-2xl" />
            </Carousel.Item>
          {/each}
        {/if}
      </Carousel.Content>
    </Carousel.Root>
  </div>
</div>
