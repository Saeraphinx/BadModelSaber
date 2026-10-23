<script lang="ts">
  import { m } from "$lib/paraglide/messages";
  import * as Pagination from "$shadcn/components/ui/pagination";
  import ChevronLeftIcon from "@lucide/svelte/icons/chevron-left";
  import ChevronRightIcon from "@lucide/svelte/icons/chevron-right";

  export let totalItems: number;
  export let selectedPageSize: number;
  export let currentPage: number;
</script>

<Pagination.Root
    count={totalItems}
    perPage={selectedPageSize}
    bind:page={currentPage}
    onPageChange={() => {
      window.scrollTo({ top: 0, behavior: "smooth" });
    }}>
    {#snippet children({ pages, currentPage })}
      <Pagination.Content>
        <Pagination.Item>
          <Pagination.PrevButton aria-label={m[`common.pagination.goToPrevious`]()}>
            <ChevronLeftIcon class="size-4" />
            <span>{m[`common.pagination.previous`]()}</span>
          </Pagination.PrevButton>
        </Pagination.Item>
        {#each pages as page (page.key)}
          {#if page.type === "ellipsis"}
            <Pagination.Item>
              <Pagination.Ellipsis />
            </Pagination.Item>
          {:else}
            <Pagination.Item>
              <Pagination.Link {page} isActive={currentPage === page.value}>
                {page.value}
              </Pagination.Link>
            </Pagination.Item>
          {/if}
        {/each}
        <Pagination.Item>
          <Pagination.NextButton aria-label={m[`common.pagination.goToNext`]()}>
            <span>{m[`common.pagination.next`]()}</span>
            <ChevronRightIcon class="size-4" />
          </Pagination.NextButton>
        </Pagination.Item>
      </Pagination.Content>
    {/snippet}
  </Pagination.Root>