<script lang="ts">
  import { AlertType, UserPermissions } from "$lib/scripts/api/DBTypes";
  import * as Tabs from "$shadcn/components/ui/tabs/index.js";
  import * as Select from "$shadcn/components/ui/select/index.js";
  import * as Accordion from "$shadcn/components/ui/accordion/index.js";
  import Label from "$shadcn/components/ui/label/label.svelte";
  import Input from "$shadcn/components/ui/input/input.svelte";
  import { Textarea } from "$shadcn/components/ui/textarea";
  import { Button } from "$shadcn/components/ui/button";
  import { Checkbox } from "$shadcn/components/ui/checkbox";
  import { toast } from "svelte-sonner";
  import { RefreshCwIcon, PlusIcon } from "@lucide/svelte";
  import { Dialog, DialogContent, DialogTrigger } from "$shadcn/components/ui/dialog/index.js";

  const { data: _internal } = $props();
  // svelte-ignore state_referenced_locally
  const { user, trpc } = $derived(_internal);
  // #region Alert
  let alertType = $state(AlertType.Generic);
  let alertUserId = $state("5");
  let alertAssetId = $state("");
  let alertRequestId = $state("");
  let alertHeader = $state("");
  let alertMessage = $state("");
  function sendAdminAlert() {
    trpc.internal.admin.createAlert
      .mutate({
        userId: parseInt(alertUserId),
        type: alertType,
        assetId: parseInt(alertAssetId) || undefined,
        requestId: parseInt(alertRequestId) || undefined,
        header: alertHeader,
        message: alertMessage,
      })
      .then((res) => {
        toast.success(`Alert sent successfully.`);
      })
      .catch((err) => {
        console.error(err);
        toast.error(`Failed to send alert.`);
      });
  }
  // #endregion

  // #region Roles
  // svelte-ignore state_referenced_locally
  let roleUserId = $state(user.id);
  let sitewidePermissions = $state<UserPermissions[]>([]);
  let perGamePermissions = $state<Record<string, UserPermissions[]>>({});
  let hasBeenLoaded = $state(false);
  function clearRoleSelections() {
    const checkboxes = document.querySelectorAll("input[type=checkbox]");
    checkboxes.forEach((checkbox) => {
      (checkbox as HTMLInputElement).checked = false;
    });
  }
  function loadUserRoles() {
    trpc.v3.user.getUserById
      .query({ id: roleUserId })
      .then((user) => {
        sitewidePermissions = user.permissions.sitewide;
        perGamePermissions = user.permissions.perGame;
        for (const perm of sitewidePermissions) {
          let checkbox = document.getElementById(`sw_${perm}`) as HTMLInputElement;
          if (checkbox) {
            checkbox.checked = true;
          }
        }
        toast.success("User roles loaded.");
        hasBeenLoaded = true;
      })
      .catch((err) => {
        console.error(err);
        toast.error("Failed to load user roles.");
      });
  }
  function sendUserRoles() {
    trpc.internal.admin.setRoles
      .mutate({
        userId: roleUserId,
        permissions: {
          sitewide: sitewidePermissions,
          perGame: perGamePermissions,
        },
      })
      .then(() => {
        toast.success("User roles updated.");
      })
      .catch((err) => {
        console.error(err);
        toast.error("Failed to update user roles.");
      });
  }
  // #endregion

  // #region Admin Logs
  let adminLogs: { timestamp: Date; level: string; message: string }[] = $state([]);
  function fetchAdminLogs() {
    trpc.internal.admin.getAdminLogs
      .query()
      .then((logs) => {
        adminLogs = logs;
        toast.success("Admin logs fetched.");
      })
      .catch((err) => {
        console.error(err);
        toast.error("Failed to fetch admin logs.");
      });
  }
  // #endregion

  // #region Admin Status
  async function getAdminStatus() {
    return await trpc.internal.status.adminStatus
      .query()
      .then((status) => {
        return status;
      })
      .catch((err) => {
        console.error(err);
        toast.error("Failed to fetch admin status.");
        return undefined;
      });
  }
  // #endregion

  // #region Game Management
  let games: Exclude<Awaited<ReturnType<typeof fetchGames>>, void> = $state([]);
  let selectedGame = $derived.by(() => games.find((game) => game.name === selectedGameName));
  let selectedGameName: string = $state("");

  // createNewGame states
  let createGameDialogOpen = $state(false);
  let newGameName = $state("");
  let newGameDisplayName = $state("");

  async function fetchGames() {
    return await trpc.v3.games.getGames
      .query()
      .then((games) => {
        toast.success("Games fetched.");
        return games;
      })
      .catch((err) => {
        console.error(err);
        toast.error("Failed to fetch games.");
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
        <p>DB Status: {adminStatus.dbConnectionOK ?? `Unknown`} | Version: {adminStatus.version} | Signed in as {adminStatus.discordTokenUser?.username}#{adminStatus.discordTokenUser?.discriminator}</p>
      {:else}
        <p>Unable to fetch admin status.</p>
      {/if}
    {:catch}
      <p>Error loading admin status.</p>
    {/await}
  </div>
  <Tabs.Root value="games">
    <Tabs.List class="m-auto">
      <Tabs.Trigger value="logs">Admin Logs</Tabs.Trigger>
      <Tabs.Trigger value="manual">Manual Operations</Tabs.Trigger>
      <Tabs.Trigger value="users">User Management</Tabs.Trigger>
      <Tabs.Trigger value="games">Game Management</Tabs.Trigger>
    </Tabs.List>
    <!-- Admin Logs Panel -->
    <Tabs.Content value="logs">
      <div class="flex flex-col items-center p-4 bg-accent rounded-lg">
        <div class="flex flex-row gap-2">
          <p class="text-2xl">Admin Logs</p>
          <Button variant="outline" size="icon" onclick={fetchAdminLogs}>
            <RefreshCwIcon />
          </Button>
        </div>
        <div class="h-[400px] w-full overflow-y-scroll bg-background-secondary rounded-lg p-2">
          {#if adminLogs.length >= 1}
            {#each adminLogs as log}
              <div class="flex flex-row mb-2">
                {#if log.level === "error"}
                  <p class="text-red-500 font-mono"><strong>[{new Date(log.timestamp).toLocaleString()}] [{log.level.toUpperCase()}]</strong> {log.message}</p>
                {:else if log.level === "warn"}
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
    </Tabs.Content>
    <!-- Manual Operations Panel -->
    <Tabs.Content value="manual">
      <div class="flex flex-row flex-wrap justify-center gap-4">
        <div class="flex flex-col items-center p-4 bg-accent rounded-lg justify-center w-[400px]">
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
                  <Input bind:value={alertUserId} placeholder="User ID" />
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
                  <Input bind:value={alertAssetId} placeholder="1234" />
                </div>
                <div class="flex flex-col">
                  <Label class="mt-4 mb-2">Request ID</Label>
                  <Input bind:value={alertRequestId} placeholder="1234" />
                </div>
              </div>
              <Label class="mt-4 mb-2">Header</Label>
              <Input bind:value={alertHeader} placeholder="Test Message" />
              <Label class="mt-4 mb-2">Message</Label>
              <Textarea bind:value={alertMessage} placeholder="This is a test message from the admins." />
              <Button onclick={sendAdminAlert} class="mt-4 mb-2 w-full">Send Alert</Button>
            </Tabs.Content>
            <Tabs.Content value="roles">
              <!-- Role Panel -->
              <Label class="mt-4 mb-2">Target User</Label>
              <div class="flex flex-row">
                <Input
                  bind:value={roleUserId}
                  class="w-3/4 mr-1"
                  placeholder="User ID"
                  oninput={() => {
                    hasBeenLoaded = false;
                    clearRoleSelections();
                  }} />
                <Button onclick={loadUserRoles} class="w-1/4">Fetch</Button>
              </div>
              <Label class="mt-4 mb-2">Permissions</Label>
              <Accordion.Root type="single" class="w-full">
                <Accordion.Item value="sitewide" class="border rounded-md mb-2">
                  <Accordion.Trigger class="bg-secondary p-2 rounded-t-md w-full text-left">Sitewide Permissions</Accordion.Trigger>
                  <Accordion.Content class="p-2">
                    <div class="flex flex-row flex-wrap gap-2 m-2">
                      {#each Object.values(UserPermissions) as item}
                        <div class="flex flex-row items-center gap-1">
                          <Checkbox
                            bind:checked={
                              () => {
                                return sitewidePermissions.includes(item);
                              },
                              (val) => {
                                if (val) {
                                  sitewidePermissions = [...sitewidePermissions, item];
                                } else {
                                  sitewidePermissions = sitewidePermissions.filter((perm) => perm !== item);
                                }
                              }
                            }
                            id={`sw_${item}`} />
                          <Label for={`sw_${item}`}>{item}</Label>
                        </div>
                      {/each}
                    </div>
                  </Accordion.Content>
                </Accordion.Item>
                {#each Object.keys(perGamePermissions) as game}
                  <Accordion.Item value={game} class="border rounded-md mb-2">
                    <Accordion.Trigger class="bg-secondary p-2 rounded-t-md w-full text-left">{game} Permissions</Accordion.Trigger>
                    <Accordion.Content class="p-2">
                      <div class="flex flex-row flex-wrap gap-2 m-2">
                        {#each Object.values(UserPermissions) as item}
                          <div class="flex flex-row items-center gap-1">
                            <Checkbox
                              bind:checked={
                                () => {
                                  return perGamePermissions[game]?.includes(item) ?? false;
                                },
                                (val) => {
                                  if (val) {
                                    perGamePermissions = {
                                      ...perGamePermissions,
                                      [game]: [...(perGamePermissions[game] ?? []), item],
                                    };
                                  } else {
                                    perGamePermissions = {
                                      ...perGamePermissions,
                                      [game]: perGamePermissions[game]?.filter((perm) => perm !== item) ?? [],
                                    };
                                  }
                                }
                              }
                              id={`${game}_${item}`} />
                            <Label for={`${game}_${item}`}>{item}</Label>
                          </div>
                        {/each}
                      </div>
                    </Accordion.Content>
                  </Accordion.Item>
                {/each}
              </Accordion.Root>
              <Button class="mt-4 mb-2 w-full" onclick={sendUserRoles} disabled={!hasBeenLoaded}>Update Roles</Button>
            </Tabs.Content>
          </Tabs.Root>
        </div>
        <div class="flex flex-col items-center p-4 bg-accent rounded-lg w-[300px]">
          <p>One-Shots</p>
          <Button
            class="mt-4 mb-2 w-full"
            onclick={() => {
              trpc.internal.admin.importOldModelSaberData
                .mutate()
                .then(() => {
                  toast.success("Import started.");
                })
                .catch((err) => {
                  console.error(err);
                  toast.error("Failed to start import.");
                });
            }}>Import Old ModelSaber Data</Button>
          <Button
            variant="destructive"
            class="mt-4 mb-2 w-full"
            onclick={() => {
              trpc.internal.admin.resetSchema
                .mutate()
                .then(() => {
                  toast.success("Schema reset started.");
                })
                .catch((err) => {
                  console.error(err);
                  toast.error("Failed to start schema reset.");
                });
            }}>Reset Database Schema</Button>
          <Button
            variant="destructive"
            class="mt-4 mb-2 w-full"
            onclick={() => {
              trpc.internal.admin.importFakeData
                .mutate()
                .then(() => {
                  toast.success("Fake data import started.");
                })
                .catch((err) => {
                  console.error(err);
                  toast.error("Failed to start fake data import.");
                });
            }}>Import Fake Data</Button>
        </div>
      </div>
    </Tabs.Content>
    <Tabs.Content value="users">
    </Tabs.Content>
    <Tabs.Content value="games">
      <div class="flex flex-col m-auto w-[400px] items-center p-4 bg-accent rounded-lg justify-center">
        <p class="p-2 text-2xl">Selected Game</p>
        <div class="flex flex-row gap-1">
          <Select.Root type="single" bind:value={selectedGameName}>
            <Select.Trigger class="w-[180px]">{selectedGame?.displayName ?? `Select a game...`}</Select.Trigger>
            <Select.Content>
              {#each games as game}
                <Select.Item value={game.name}>{game.displayName}</Select.Item>
              {/each}
            </Select.Content>
          </Select.Root>
          <Button variant="outline" size="icon" onclick={fetchGames}><RefreshCwIcon /></Button>
          <Button variant="default" size="icon" onclick={() => (createGameDialogOpen = true)}><PlusIcon /></Button>
        </div>
      </div>
      {#if selectedGame}
        <Tabs.Root class="mt-2" value="details">
          <Tabs.List class="m-auto">
            <Tabs.Trigger value="details">Details</Tabs.Trigger>
            <Tabs.Trigger value="versions">Versions</Tabs.Trigger>
            <Tabs.Trigger value="webhooks">Webhooks</Tabs.Trigger>
          </Tabs.List>
          <Tabs.Content value="details">
          </Tabs.Content>
          <Tabs.Content value="versions">
          </Tabs.Content>
          <Tabs.Content value="webhooks">
          </Tabs.Content>
        </Tabs.Root>
      {/if}
    </Tabs.Content>
  </Tabs.Root>
</div>


<Dialog bind:open={createGameDialogOpen}>
  <DialogContent>
    <div class="flex flex-col items-center rounded-lg justify-center">
      <p class="p-2 text-2xl">Create New Game</p>
      <Input placeholder="Game Name" class="w-full mb-2" bind:value={newGameName} />
      <Input placeholder="Display Name" class="w-full mb-2" bind:value={newGameDisplayName} />
      <Button class="w-full" onclick={() => {

      }}>Create Game</Button>
    </div>
  </DialogContent>
</Dialog>