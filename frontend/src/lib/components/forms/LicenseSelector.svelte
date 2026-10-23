<script lang="ts">
  import { m } from "$lib/paraglide/messages";
  import ChevronsUpDown from "@lucide/svelte/icons/chevrons-up-down";
  import * as Popover from "$shadcn/components/ui/popover/index.js";
  import { buttonVariants } from "$shadcn/components/ui/button/index.js";
  import { onMount } from "svelte";
  import Checkbox from "$shadcn/components/ui/checkbox/checkbox.svelte";
  import Label from "$shadcn/components/ui/label/label.svelte";
  import Separator from "$shadcn/components/ui/separator/separator.svelte";

  let { value = $bindable(""), id = "license" } = $props();
  let displayedValue = $state<string>(m[`assets.license.select`]());

  const licenses = [
    { label: "Creative Commons Zero v1.0 Universal", value: "cc0-1.0" },
    { label: "Creative Commons BY 4.0", value: "cc4.0-by" },
    { label: "Creative Commons BY-SA 4.0", value: "cc4.0-by-sa" },
    { label: "Creative Commons BY-ND 4.0", value: "cc4.0-by-nd" },
    { label: "Creative Commons BY-NC 4.0", value: "cc4.0-by-nc" },
    { label: "Creative Commons BY-NC-SA 4.0", value: "cc4.0-by-nc-sa" },
    { label: "Creative Commons BY-NC-ND 4.0", value: "cc4.0-by-nc-nd" },
    { label: m[`assets.license.custom`](), value: "custom" },
  ];

  function updateValues() {
    if (attribution) {
      if (nonCommercial) {
        if (noDerivatives) {
          value = "cc4.0-by-nc-nd";
        } else if (shareAlike) {
          value = "cc4.0-by-nc-sa";
        } else {
          value = "cc4.0-by-nc";
        }
      } else if (noDerivatives) {
        value = "cc4.0-by-nd";
      } else if (shareAlike) {
        value = "cc4.0-by-sa";
      } else {
        value = "cc4.0-by";
      }
    } else {
      value = "cc0-1.0"; // Default to CC0 if no other options are selected
    }

    if (custom) {
      value = "custom";
    }

    displayedValue = licenses.find((l) => l.value === value)?.label || "Unable to display license";
    console.log(`License updated to: ${value}`);
  };

  onMount(() => {
    updateValues();
  });

  let custom = $state(false);
  let attribution = $state(false);
  let nonCommercial = $state(false);
  let noDerivatives = $state(false);
  let shareAlike = $state(false);
</script>

{#snippet checkboxes()}
  <div class="flex flex-col flex-wrap gap-1">
    <p class="text-base">{m[`assets.license.heading`]()}</p>
    <p class="text-sm text-gray-500">
      {m[`assets.license.description`]()}<br>
      {@html m[`assets.license.moreInfo`]({ link: `<a class="underline" href="https://creativecommons.org/share-your-work/cclicenses/" target="_blank">creativecommons.org</a>` })}
    </p>
    <!-- Attribution -->
    <span class="flex flex-row items-center">
      <Checkbox
        id="attribution"
        bind:checked={attribution}
        onCheckedChange={(value) => {
          if (value) {
            custom = false;
          } else {
            nonCommercial = false;
            noDerivatives = false;
            shareAlike = false;
          }
          updateValues();
        }} />
      <Label for="attribution" class="p-2">{m[`assets.license.attribution`]()}</Label>
    </span>
    <!-- Non-Commercial -->
    <span class="flex flex-row items-center">
      <Checkbox
        id="nonCommercial"
        bind:checked={nonCommercial}
        onCheckedChange={(value) => {
          if (value) {
            attribution = true;
            custom = false;
          }
          updateValues();
        }} />
      <Label for="nonCommercial" class="p-2">{m[`assets.license.nonCommercial`]()}</Label>
    </span>
    <!-- No Derivatives -->
    <span class="flex flex-row items-center">
      <Checkbox
        id="noDerivatives"
        bind:checked={noDerivatives}
        onCheckedChange={(value) => {
          if (value) {
            attribution = true;
            shareAlike = false;
            custom = false;
          }
          updateValues();
        }} />
      <Label for="noDerivatives" class="p-2">{m[`assets.license.noDerivatives`]()}</Label>
    </span>
    <!-- Share Alike -->
    <span class="flex flex-row items-center">
      <Checkbox
        id="shareAlike"
        bind:checked={shareAlike}
        onCheckedChange={(value) => {
          shareAlike = value;
          if (value) {
            attribution = true;
            noDerivatives = false;
            custom = false;
          }
          updateValues();
        }} />
      <Label for="shareAlike" class="p-2">{m[`assets.license.shareAlike`]()}</Label>
    </span>
    <Separator />
    <!-- Custom -->
    <span class="flex flex-row items-center">
    <Checkbox
      id="custom"
      bind:checked={custom}
      onCheckedChange={(value) => {
        if (value) {
          attribution = false;
          nonCommercial = false;
          noDerivatives = false;
          shareAlike = false;
        }
        updateValues();
      }} />
    <Label for="custom" class="p-2">{m[`assets.license.custom`]()}</Label>
    </span>
  </div>
{/snippet}

<Popover.Root >
  <Popover.Trigger {id} class={buttonVariants({ variant: "outline", class: "w-full justify-between" })}>
    {displayedValue}
    <ChevronsUpDown class="ml-2 h-4 w-4 shrink-0 opacity-50" />
  </Popover.Trigger>
  <Popover.Content class="p-3">
    {@render checkboxes()}
  </Popover.Content>
</Popover.Root>

<!-- <Command.Root>
      <Command.Input placeholder="Search license..." />
      <Command.Empty>No framework found.</Command.Empty>
      <Command.Group>
        {#each licenses as license}
          <Command.Item
            value={license.value}
            onSelect={() => {
              value = license.value;
              closeAndFocusTrigger(id);
            }}>
            <Check class={cn("mr-2 h-4 w-4", value !== license.value && "text-transparent")} />
            {license.label}
          </Command.Item>
        {/each}
      </Command.Group>
    </Command.Root> -->
