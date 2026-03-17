<script lang="ts">
  import { m } from "$lib/paraglide/messages";
  import { Button } from "$shadcn/components/ui/button";
  import { ChevronLeft, ChevronRight } from "@lucide/svelte";

  export let totalCount: number;
  export let selectedPageSize: number;
  export let currentPage: number;
</script>
<div class="flex flex-row items-center">
    <Button variant="outline" size="icon" onclick={() => (currentPage > 1 ? currentPage-- : null)}>
      <ChevronLeft class="h-4 w-4" />
    </Button>
    <span class="text-sm whitespace-nowrap mx-2">{m["assets.search.xToYOfZAssets"]({
      start: (currentPage - 1) * selectedPageSize + 1,
      end: selectedPageSize * currentPage > totalCount ? totalCount : selectedPageSize * currentPage,
      total: totalCount
    })}</span>
    <Button variant="outline" size="icon" onclick={() => currentPage++}>
      <ChevronRight class="h-4 w-4" />
    </Button>
  </div>