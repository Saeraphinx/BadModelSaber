<script lang="ts">
  import { AlertType, UserPermissions } from "$lib/scripts/api/DBTypes";
  import * as Tabs from "$shadcn/components/ui/tabs/index.js";
  import * as Select from "$shadcn/components/ui/select/index.js";
  import Label from "$shadcn/components/ui/label/label.svelte";
  import Input from "$shadcn/components/ui/input/input.svelte";
  import { Textarea } from "$shadcn/components/ui/textarea";
  import { Button } from "$shadcn/components/ui/button";
  import { Checkbox } from "$shadcn/components/ui/checkbox";
  import { toast } from "svelte-sonner";
  import { trpc } from "$lib/scripts/utils/api";
  import { RefreshCwIcon } from "@lucide/svelte";

  // #region Alert
  let alertType = $state(AlertType.AssetVerified);
  let alertUserId = $state("");
  let alertAssetId = $state("");
  let alertRequestId = $state("");
  let alertHeader = $state("");
  let alertMessage = $state("");
  function sendAdminAlert() {
    trpc.AdminRouter.createAlert.mutate({
      userId: alertUserId,
      type: alertType,
      assetId: parseInt(alertAssetId) || undefined,
      requestId: parseInt(alertRequestId) || undefined,
      header: alertHeader,
      message: alertMessage,
    }).then((res) => {
      toast.success(`Alert sent successfully.`);
    }).catch((err) => {
      console.error(err);
      toast.error(`Failed to send alert.`);
    });
  }
  // #endregion

  // #region Roles
  let roleUserId = $state("");
  let rolePermissions = $state<UserPermissions[]>([]);
  let hasBeenLoaded = $state(false);
  function clearRoleSelections() {
    const checkboxes = document.querySelectorAll("input[type=checkbox]");
    checkboxes.forEach((checkbox) => {
      (checkbox as HTMLInputElement).checked = false;
    });
  }
  function loadUserRoles() {
    trpc.userRouterV3.getUserById.query({ id: roleUserId }).then((user) => {
      rolePermissions = user.roles;
      for (const perm of user.roles) {
        let checkbox = document.getElementById(perm) as HTMLInputElement;
        if (checkbox) {
          checkbox.checked = true;
        }
      }
      toast.success("User roles loaded.");
      hasBeenLoaded = true;
    }).catch((err) => {
      console.error(err);
      toast.error("Failed to load user roles.");
    });
  }
  function sendUserRoles() {
    trpc.AdminRouter.setRoles.mutate({
      userId: roleUserId,
      roles: rolePermissions,
    }).then(() => {
      toast.success("User roles updated.");
    }).catch((err) => {
      console.error(err);
      toast.error("Failed to update user roles.");
    });
  }
  // #endregion

  // #region Admin Logs
  let adminLogs: { timestamp: Date; level: string; message: string }[] = $state([]);
  function fetchAdminLogs() {
    trpc.AdminRouter.getAdminLogs.query().then((logs) => {
      adminLogs = logs;
      toast.success("Admin logs fetched.");
    }).catch((err) => {
      console.error(err);
      toast.error("Failed to fetch admin logs.");
    });
  }
  // #endregion

  // #region Admin Status
  async function getAdminStatus() {
    return await trpc.statusRouter.adminStatus.query().then((status) => {
      return status;
    }).catch((err) => {
      console.error(err);
      toast.error("Failed to fetch admin status.");
      return undefined;
    });
  }
</script>

<div class="flex flex-col gap-4 m-auto p-4 justify-center">
  <div class="flex flex-col m-auto justify-center text-center">
    <div class="text-3xl mb-4">Admin Panel</div>
    {#await getAdminStatus()}
      <p>Loading Admin Data...</p>
    {:then adminStatus}
      {#if adminStatus}
        <p>DB Status: {adminStatus.dbConnectionOK ?? `Unknown`} | Version: {adminStatus.version} | Signed in as {adminStatus.discordTokenUser?.username}#{adminStatus.discordTokenUser?.descriminator}</p>
      {:else}
        <p>Unable to fetch admin status.</p>
      {/if}
    {:catch}
      <p>Error loading admin status.</p>
    {/await}
  </div>
  <div class="flex flex-col md:flex-row">
    <div class="flex flex-col items-center justify-center p-4 bg-accent rounded-lg m-auto w-[400px]">
      <div class="flex flex-row gap-2">
        <p class="text-2xl">
          Admin Logs
        </p>
        <Button variant="outline" size="icon" onclick={fetchAdminLogs}>
          <RefreshCwIcon />
        </Button>
      </div>
      <div class="h-[400px] w-full overflow-y-scroll bg-background-secondary rounded-lg p-2">
        {#if adminLogs.length >= 1}
          {#each adminLogs as log}
            <div class="flex flex-row mb-2">
              {#if log.level === 'error'}
                <p class="text-red-500 font-mono"><strong>[{new Date(log.timestamp).toLocaleString()}] [{log.level.toUpperCase()}]</strong> {log.message}</p>
              {:else if log.level === 'warn'}
                <p class="text-yellow-500 font-mono"><strong>[{new Date(log.timestamp).toLocaleString()}] [{log.level.toUpperCase()}]</strong> {log.message}</p>
              {:else}
                <p class="font-mono"><strong>[{new Date(log.timestamp).toLocaleString()}] [{log.level.toUpperCase()}]</strong> {log.message}</p>
              {/if}
            </div>
          {/each}
        {:else}
          <div class="flex flex-col items-center justify-center h-full">
            <p>No logs to display. Click the refresh button to load logs.</p>
          </div>
        {/if}
      </div>
    </div>
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
          <Button onclick={sendAdminAlert} class="mt-4 mb-2 w-full">Send Alert</Button>
        </Tabs.Content>
        <Tabs.Content value="roles">
          <!-- Role Panel -->
          <Label class="mt-4 mb-2">Target User</Label>
          <div class="flex flex-row">
            <Input bind:value={roleUserId} class="w-3/4 mr-1" placeholder="User ID" oninput={() => {
              hasBeenLoaded = false;
              clearRoleSelections();
            }}/>
            <Button onclick={loadUserRoles} class="w-1/4">Fetch</Button>
          </div>
          <Label class="mt-4 mb-2">Permissions</Label>
          <div class="flex flex-row flex-wrap gap-2 m-2">
            {#each Object.values(UserPermissions) as item}
              <div class="flex flex-row items-center gap-1">
                <Checkbox bind:checked={() => {return rolePermissions.includes(item)}, (val) => {
                  if (val) {
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
    <div class="flex flex-col items-center justify-center p-4 bg-accent rounded-lg m-auto w-[400px]">
      <p>One-Shots</p>
      <Button class="mt-4 mb-2 w-full" onclick={() => {
        trpc.AdminRouter.importOldModelSaberData.mutate().then(() => {
          toast.success("Import started.");
        }).catch((err) => {
          console.error(err);
          toast.error("Failed to start import.");
        });
      }}>Import Old ModelSaber Data</Button>
    </div>
  </div>
</div>
