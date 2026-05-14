<script lang="ts">
  import ChevronsUpDownIcon from "@lucide/svelte/icons/chevrons-up-down";
  import { tick } from "svelte";
  import * as Command from "$shadcn/components/ui/command/index.js";
  import * as Popover from "$shadcn/components/ui/popover/index.js";
  import { buttonVariants } from "$shadcn/components/ui/button/index.js";
  import { cn } from "$shadcn/utils.js";
  import type { ClassValue } from "svelte/elements";
  import { trpc } from "$lib/scripts/utils/api";
  import debounce from "debounce";

  let { 
    selectedProjectName = $bindable(``),
    selectedProjectId = $bindable(-1), 
    selectedProjectNameId = $bindable(),
    open = $bindable(true), 
    id = "depProjectSelector",
    gameName = "",
    class: className = "",
  } : {
    selectedProjectName?: string;
    selectedProjectId?: number;
    selectedProjectNameId?: string;
    open?: boolean;
    id?: string;
    gameName?: string;
    class?: ClassValue;
  } = $props();

  let triggerRef: HTMLButtonElement | null = $state(null);

  // We want to refocus the trigger button when the user selects
  // an item from the list so users can continue navigating the
  // rest of the form with the keyboard.
  function closeAndFocusTrigger() {
    open = false;
    tick().then(() => {
      triggerRef?.focus();
    });
  }

  let searchQuery = $state("");
  let searchResults: {name: string, id:number, nameId: string}[] = $state([]);
  async function searchProjects(query: string) {
    if (query.length === 0) return searchResults;
    let res = await trpc.internal.mods.searchProjects.query({ query, gameName: gameName });
    return res;
  }
</script>

<Popover.Root>
  <Popover.Trigger bind:ref={triggerRef} class={cn(buttonVariants({ variant: "outline", class: "justify-between" }), className)} {id} aria-expanded={open}>
        {selectedProjectName || "Select a project..."}
        <ChevronsUpDownIcon class="ml-2 size-4 shrink-0 opacity-50" />
  </Popover.Trigger>
  <Popover.Content class="p-0">
    <Command.Root shouldFilter={false} >
      <Command.Input bind:value={searchQuery} oninput={debounce(() => {
          searchProjects(searchQuery).then((res) => {
            searchResults = res;
          });
        }, 500)
      } placeholder="Search projects..." />
      <Command.List>
        <Command.Empty>No project found.</Command.Empty>
        {#each searchResults as project}
          <Command.Item
            value={project.id.toString()}
            onSelect={() => {
              //console.log("Selected project ID:", selectedProjectId);
              selectedProjectId = project.id;
              selectedProjectName = project.name;
              selectedProjectNameId = project.nameId;
              closeAndFocusTrigger();
            }}
          >
            {project.name}
            <p class="text-xs text-gray-500">{`ID: ${project.id}`}</p>
          </Command.Item>
        {/each}
      </Command.List>
    </Command.Root>
  </Popover.Content>
</Popover.Root>
