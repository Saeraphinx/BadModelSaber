<script lang="ts">
  import Button from "$shadcn/components/ui/button/button.svelte";
  import * as Carousel from "$shadcn/components/ui/carousel/index.js";
  import { type CarouselAPI } from "$shadcn/components/ui/carousel/context.js";
  import { ChevronLeftIcon, ChevronRightIcon } from "@lucide/svelte";
  import { onMount } from "svelte";

  let {
    api,
    showOnlyOne = true,
    numberOfDots,
  }: {
    api: CarouselAPI;
    showOnlyOne?: boolean;
    numberOfDots?: number;
  } = $props();

  let currentIndexes: number[] = $state([0]);
  let itemsCount = $derived.by(() => {
    if (numberOfDots) {
      return numberOfDots;
    } else {
      return api?.slideNodes().length || 1;
    }
  });
  //console.log("CarouselNavigator items", items);
  onMount(() => {
    if (api) {
      // Initialize currentIndexes based on the API state
      currentIndexes = showOnlyOne ? [api.selectedScrollSnap() ?? 0] : (api.slidesInView() || []);
      // Update currentIndexes when the carousel scrolls
      api.on(`select`, () => {
        if (showOnlyOne) {
          currentIndexes = [api.selectedScrollSnap() ?? 0];
        } else {
          currentIndexes = api.slidesInView() || [];
        }
      });
    } else {
      console.warn("Carousel API is not provided to CarouselNavigator.");
    }
  });
</script>

<div class="flex justify-between items-center w-full mt-2">
  <Button variant="ghost" size="icon" onclick={() => api?.scrollPrev()}>
    <ChevronLeftIcon class="w-5 h-5" />
  </Button>
  {#each {length: itemsCount} as idk, index}
    <Button variant="ghost" size="icon" class={itemsCount > 5 ? `not-md:size-4 not-md:p-1` : ``} onclick={() => api?.scrollTo(index)}>
      {#key currentIndexes}
        <span class="h-2 w-2 rounded-4xl transition-all duration-300 {currentIndexes.includes(index) ? `bg-gray-400 dark:bg-gray-200` : `bg-gray-200 dark:bg-gray-500`}"></span>
      {/key}
    </Button>
  {/each}
  <Button variant="ghost" size="icon" onclick={() => api?.scrollNext()}>
    <ChevronRightIcon class="w-5 h-5" />
  </Button>
</div>
