<script lang="ts">
  import type { VersionApiV3 } from "$lib/scripts/api/DBTypes";
  import { getRelativeTimeString } from "$lib/scripts/utils/stylizer";
  import * as Tabs from "$shadcn/components/ui/tabs";
  import { FileCodeIcon, FolderIcon, InfoIcon, ShieldPlusIcon } from "@lucide/svelte";
  import ApprovalDialog from "../dialogs/ApprovalDialog.svelte";

  const { 
    version,
    approvalDialog,
    codeDialog,
    manifestDialog,
  }: {
    version: VersionApiV3,
    approvalDialog?: ApprovalDialog,
    codeDialog?: any,
    manifestDialog?: any,
  } = $props();
</script>

<div class="p-2 border rounded-lg bg-card">
  <div class="flex items-start justify-between mb-2">
    <span class="text-lg font-medium">{version.semver}</span>
    <span title={new Date(version.createdAt).toISOString()} class="text-sm text-gray-500">{getRelativeTimeString(new Date(version.createdAt))}</span>
  </div>
  <Tabs.Root>
    <Tabs.List class="border-b mb-2">
      <Tabs.Trigger value="info" class="">
        <InfoIcon />
      </Tabs.Trigger>
      <Tabs.Trigger value="files" class="">
        <FolderIcon />
      </Tabs.Trigger>
      <Tabs.Trigger value="dependencies" class="">
        <ShieldPlusIcon />
      </Tabs.Trigger>
      <Tabs.Trigger value="code" class="">
        <FileCodeIcon />
      </Tabs.Trigger>
    </Tabs.List>
    
  </Tabs.Root>
</div>
  