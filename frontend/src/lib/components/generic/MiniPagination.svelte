<script lang="ts">
  import { m } from "$lib/paraglide/messages";
  import { Button } from "$shadcn/components/ui/button";
  import { ChevronLeft, ChevronRight } from "@lucide/svelte";

  let {
    totalCount = $bindable(0),
    selectedPageSize = $bindable(10),
    currentPage = $bindable(1)
  } : {
    totalCount: number,
    selectedPageSize: number,
    currentPage: number
  } = $props();

  let pageString = $derived.by(() => {
    return m[`search.pagination.summary`]({
      start: (currentPage - 1) * selectedPageSize + 1,
      end: selectedPageSize * currentPage > totalCount ? totalCount : selectedPageSize * currentPage,
      total: totalCount,
    });
  });
</script>
<div class="flex flex-row items-center">
    <Button variant="outline" size="icon" onclick={() => (currentPage > 1 ? currentPage-- : null)} disabled={currentPage <= 1}>
      <ChevronLeft class="h-4 w-4" />
    </Button>
      <span class="text-sm whitespace-nowrap mx-2">{pageString}</span>
    <Button variant="outline" size="icon" onclick={() => currentPage++} disabled={currentPage * selectedPageSize >= totalCount}>
      <ChevronRight class="h-4 w-4" />
    </Button>
  </div>