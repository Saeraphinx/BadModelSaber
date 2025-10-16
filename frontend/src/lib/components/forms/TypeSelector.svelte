<script lang="ts">
  import CheckIcon from "@lucide/svelte/icons/check";
  import ChevronsUpDownIcon from "@lucide/svelte/icons/chevrons-up-down";
  import { tick } from "svelte";
  import * as Command from "$shadcn/components/ui/command/index.js";
  import * as Popover from "$shadcn/components/ui/popover/index.js";
  import { Button, buttonVariants } from "$shadcn/components/ui/button/index.js";
  import { cn } from "$shadcn/utils.js";
  import { AssetFileFormat } from "$lib/scripts/api/DBTypes";
  import { getAssetTypeData } from "$lib/scripts/utils/stylizer";
  import type { ClassValue } from "svelte/elements";

  let { 
    value = $bindable(""), 
    open = $bindable(true), 
    id = "typeSelector",
    class: className = "",
  } : {
    value?: string;
    open?: boolean;
    id?: string;
    class?: ClassValue;
  } = $props();

  let types = Object.values(AssetFileFormat).map((type) => {
    let typeData = getAssetTypeData(type);
    return {
      label: typeData.combinedString,
      value: type,
    };
  });

  const selectedValue = $derived(types.find((f) => f.value === value)?.label);
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
</script>

<Popover.Root>
  <Popover.Trigger bind:ref={triggerRef} class={cn(buttonVariants({ variant: "outline", class: "w-full justify-between" }), className)} {id} aria-expanded={open}>
        {selectedValue || "Select a type..."}
        <ChevronsUpDownIcon class="ml-2 size-4 shrink-0 opacity-50" />
  </Popover.Trigger>
  <Popover.Content class="p-0">
    <Command.Root>
      <Command.Input placeholder="Search types..." />
      <Command.List>
        <Command.Empty>No asset type found.</Command.Empty>
        <Command.Group>
          {#each types as type}
            <Command.Item
              value={type.value}
              onSelect={() => {
                value = type.value;
                closeAndFocusTrigger();
              }}>
              <CheckIcon class={cn("mr-2 size-4", value !== type.value && "text-transparent")} />
              {type.label}
            </Command.Item>
          {/each}
        </Command.Group>
      </Command.List>
    </Command.Root>
  </Popover.Content>
</Popover.Root>
