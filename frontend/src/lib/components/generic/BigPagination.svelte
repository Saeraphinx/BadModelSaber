<script lang="ts">
  import * as Pagination from "$shadcn/components/ui/pagination";

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
          <Pagination.PrevButton />
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
          <Pagination.NextButton />
        </Pagination.Item>
      </Pagination.Content>
    {/snippet}
  </Pagination.Root>