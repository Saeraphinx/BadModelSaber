<script lang="ts">
  import { AlertType, UserPermissions } from "$lib/scripts/api/DBTypes";
  import * as Tabs from "$shadcn/components/ui/tabs/index.js";
  import * as Select from "$shadcn/components/ui/select/index.js";
  import Label from "$shadcn/components/ui/label/label.svelte";
  import Input from "$shadcn/components/ui/input/input.svelte";
  import { Textarea } from "$shadcn/components/ui/textarea";
  import { Button } from "$shadcn/components/ui/button";
  import Checkbox from "$shadcn/components/ui/checkbox/checkbox.svelte";
  import { toast } from "svelte-sonner";

  // #region Alert
  let alertType = $state(AlertType.AssetApproved);
  let alertUserId = $state("");
  let alertAssetId = $state("");
  let alertRequestId = $state("");
  let alertHeader = $state("");
  let alertMessage = $state("");
  function sendAdminAlert() {
    fetchApiSafe("/admin/alert", {
      method: "POST",
      body: JSON.stringify({
        userId: alertUserId,
        type: alertType,
        assetId: alertAssetId,
        requestId: alertRequestId,
        header: alertHeader,
        message: alertMessage,
      }),
    }).then((res) => {
      if (res.isError) {
        toast.error(`Error sending alert: ${res.message}`);
      } else {
        toast.success(`Alert sent successfully. ${res.message}`);
      }
    });
  }
  // #endregion

  // #region Roles
  let roleUserId = $state("");
  let rolePermissions = $state<UserPermissions[]>([]);
  let hasBeenLoaded = $state(false);
  function loadUserRoles() {
    toast.info("Not Impliemented");
    hasBeenLoaded = true;
  }
  function sendUserRoles() {
    toast.info("Not Impliemented");
  }
</script>

<div class="flex flex-col items-center justify-center p-4 bg-accent rounded-lg m-auto w-[400px]">
  <p class="p-2 text-2xl">Manual Operations</p>
  <Tabs.Root value="roles" class="w-full">
    <Tabs.List class="m-auto">
      <Tabs.Trigger value="alerts">Alerts</Tabs.Trigger>
      <Tabs.Trigger value="roles">Roles</Tabs.Trigger>
      <Tabs.Trigger value="requests">Requests</Tabs.Trigger>
    </Tabs.List>
    <Tabs.Content value="alerts">
      <!-- Alert Panel -->
      <div class="flex flex-row gap-2">
        <div class="flex flex-col">
          <Label class="mt-4 mb-2">Target User</Label>
          <Input placeholder="User ID" />
        </div>
        <div class="flex flex-col">
          <Select.Root type="single" bind:value={alertType}>
            <Label class="mt-4 mb-2">Alert Type</Label>
            <Select.Trigger class="w-[180px]">{alertType}</Select.Trigger>
            <Select.Content>
              {#each Object.values(AlertType) as item}
                <Select.Item value={item}>{item}</Select.Item>
              {/each}
            </Select.Content>
          </Select.Root>
        </div>
      </div>
      <div class="flex flex-row gap-2">
        <div class="flex flex-col">
          <Label class="mt-4 mb-2">Asset ID</Label>
          <Input class="" placeholder="1234" />
        </div>
        <div class="flex flex-col">
          <Label class="mt-4 mb-2">Request ID</Label>
          <Input class="" placeholder="1234" />
        </div>
      </div>
      <Label class="mt-4 mb-2">Header</Label>
      <Input placeholder="Test Message" />
      <Label class="mt-4 mb-2">Message</Label>
      <Textarea placeholder="This is a test message from the admins." />
      <Button class="mt-4 mb-2 w-full">Send Alert</Button>
    </Tabs.Content>
    <Tabs.Content value="roles">
      <!-- Role Panel -->
      <Label class="mt-4 mb-2">Target User</Label>
      <div class="flex flex-row">  
        <Input bind:value={roleUserId} class="w-3/4 mr-1" placeholder="User ID" />
        <Button onclick={loadUserRoles} class="w-1/4">Fetch</Button>
      </div>
      <Label class="mt-4 mb-2">Permissions</Label>
      <div class="flex flex-row flex-wrap gap-2 m-2">
        {#each Object.values(UserPermissions) as item}
          <div class="flex flex-row items-center gap-1">
            <Checkbox onclick={(e) => {
              if ((e.target as HTMLInputElement).checked) {
                rolePermissions = [...rolePermissions, item];
              } else {
                rolePermissions = rolePermissions.filter((perm) => perm !== item);
              }
            }} id={item} />
            <Label for={item}>{item}</Label>
          </div>
        {/each}
      </div>
      <Button class="mt-4 mb-2 w-full" onclick={sendUserRoles} disabled={!hasBeenLoaded}>Update Roles</Button>
    </Tabs.Content>
  </Tabs.Root>
</div>
