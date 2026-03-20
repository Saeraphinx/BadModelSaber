<script lang="ts">
  import { AlertType, UserPermissions, WebhookLogType, type GameVersionApiV3, type GameVersionApiV3_full } from "$lib/scripts/api/DBTypes";
  import * as Tabs from "$shadcn/components/ui/tabs/index.js";
  import * as Select from "$shadcn/components/ui/select/index.js";
  import * as Accordion from "$shadcn/components/ui/accordion/index.js";
  import Label from "$shadcn/components/ui/label/label.svelte";
  import Input from "$shadcn/components/ui/input/input.svelte";
  import { Textarea } from "$shadcn/components/ui/textarea";
  import { Button } from "$shadcn/components/ui/button";
  import { Checkbox } from "$shadcn/components/ui/checkbox";
  import { toast } from "svelte-sonner";
  import { RefreshCwIcon, PlusIcon, PencilLine, TrashIcon } from "@lucide/svelte";
  import { Dialog, DialogContent } from "$shadcn/components/ui/dialog/index.js";
  import { checkRoles } from "$lib/scripts/utils/checkRoles.js";
  import { onMount } from "svelte";
  import { parseErrorMessage } from "$lib/scripts/utils/api.js";

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
  let games: Exclude<Awaited<ReturnType<typeof fetchGames>>, never[]> = $state([]);
  let gameVersions: Record<string, GameVersionApiV3_full[]> = $state({});
  let selectedGame = $derived.by(() => games.find((game) => game.name === selectedGameName));
  let selectedGameName: string = $state("");
  let selectedGameCanVersion = $derived.by(() => checkRoles(user, [UserPermissions.Game_EditVersions], selectedGame?.name));
  let selectedGameCanEdit = $derived.by(() => checkRoles(user, [UserPermissions.Game_Edit], selectedGame?.name));

  // dialogs
  let createGameDialogOpen = $state(false);
  let newGameName = $state("");
  let newGameDisplayName = $state("");

  let createVersionDialogOpen = $state(false);
  let createVersionVersion = $state("");

  let linkVersionDialogOpen = $state(false);
  let linkVersionSourceId = $state("");
  let linkVersionTargetId = $state("");

  let createWebhookDialogOpen = $state(false);
  let newWebhookUrl = $state("");
  let newWebhookTypes: WebhookLogType[] = $state([]);
  let newWebhookIsAsset = $state(false);

  async function fetchGames() {
    let showExtra = checkRoles(user, [UserPermissions.Game_ViewExtras]);
    return await trpc.v3.games.getGames
      .query(showExtra)
      .then(async (fetchedGames) => {
        games = fetchedGames;
        for (const game of games) {
          await trpc.v3.games.getGameVersions
            .query({ gameName: game.name, includeExtras: true })
            .then((res) => {
              gameVersions[game.name] = res.gameVersions as GameVersionApiV3_full[];
            })
            .catch((err) => {
              console.error(err);
              toast.error(`Failed to fetch versions for ${game.displayName}.`);
            });
        }
        return fetchedGames;
      })
      .catch((err) => {
        console.error(err);
        toast.error("Failed to fetch games.");
        return [];
      });
  }

  onMount(async () => {
    await fetchGames();
    selectedGameName = games.find((game) => game.default)?.name ?? "";
  });
  // #endregion
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
    <Tabs.Content value="users"></Tabs.Content>
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
          <Button variant="outline" size="icon" onclick={() => {fetchGames(); toast.success("Games fetched.");}}><RefreshCwIcon /></Button>
          {#if checkRoles(user, [UserPermissions.Game_Create])}
            <Button variant="default" size="icon" onclick={() => (createGameDialogOpen = true)}><PlusIcon /></Button>
          {/if}
        </div>
      </div>
      {#if selectedGame}
        <Tabs.Root class="mt-2" value="versions">
          <Tabs.List class="m-auto">
            <Tabs.Trigger value="details">Details</Tabs.Trigger>
            {#if selectedGameCanVersion}
              <Tabs.Trigger value="versions">Versions</Tabs.Trigger>
            {/if}
            {#if selectedGameCanEdit}
              <Tabs.Trigger value="webhooks">Webhooks</Tabs.Trigger>
            {/if}
          </Tabs.List>
          <Tabs.Content value="details">
              <div class="flex flex-col items-center p-4 bg-accent rounded-lg">
                <p><strong>Name:</strong> {selectedGame.name}</p>
                <p><strong>Display Name:</strong> {selectedGame.displayName}</p>
                <p><strong>Platforms:</strong> {selectedGame.platforms.join(", ")}</p>
                <p><strong>Categories:</strong> {selectedGame.categories.join(", ")}</p>
                <p><strong>Is Default:</strong> {selectedGame.default ? "Yes" : "No"}</p>
              </div>
          </Tabs.Content>
          <Tabs.Content value="versions" class="flex flex-col items-center">
            <div class="flex flex-row mb-4 gap-2">
              <Button variant="default" onclick={() => (createVersionDialogOpen = true)}><PlusIcon />Create New Version</Button>
              <Button variant="default" onclick={() => (linkVersionDialogOpen = true)}>
                <PlusIcon />Link Versions
              </Button>
            </div>
            <table class="table-auto m-auto w-full">
              <thead>
                <tr>
                  <th>Version ID</th>
                  <th>Version</th>
                  <th>Default</th>
                  <th>Linked Versions</th>
                  <th>Created At</th>
                  <th>Updated At</th>
                </tr>
              </thead>
              <tbody>
                {#each gameVersions[selectedGame.name] ?? [] as version}
                  <tr>
                    <td>{version.id}</td>
                    <td>{version.version}</td>
                    <td>
                      <Button variant={version.defaultVersion ? "default" : "outline"} disabled={version.defaultVersion} onclick={() => {
                        trpc.internal.games.setDefaultVersion
                          .mutate({ gameName: selectedGame.name, versionId: version.id })
                          .then(() => {
                            toast.success(`Version ${version.version} set as default.`);
                            fetchGames()
                          }).catch((err) => {
                            console.error(err);
                            toast.error(`Failed to set version ${version.version} as default. ${parseErrorMessage(err)}`);
                          });
                      }}>
                        {version.defaultVersion ? "Default" : "Set as Default"}
                      </Button>
                    </td>
                    <td>
                      {version.linkedVersionIds.length > 0 ? `Linked to: ${version.linkedVersionIds.join(", ")}` : "No linked versions"}
                      <Button variant="outline" size="icon" class="ml-2">
                        <PencilLine />
                      </Button>
                    </td>
                    <td>{`${new Date(version.createdAt).toLocaleString()}`}</td>
                    <td>{`${new Date(version.updatedAt).toLocaleString()}`}</td>
                  </tr>
                {/each}
              </tbody>
            </table>
          </Tabs.Content>
          <Tabs.Content value="webhooks" class="flex flex-col items-center">
            <Button variant="default" class="mb-4" onclick={() => (createWebhookDialogOpen = true)}><PlusIcon />Create New Webhook</Button>
            <table class="table-auto m-auto w-full">
              <thead>
                <tr>
                  <th>Webhook ID</th>
                  <th>Type</th>
                  <th>URL</th>
                </tr>
              </thead>
              <tbody>
                {#each selectedGame.webhooks ?? [] as webhook}
                  <tr>
                    <td>{webhook.id}</td>
                    <td>{webhook.types.join(", ")}</td>
                    <td>{webhook.url}</td>
                    <td>
                      <Button variant="outline" size="icon">
                        <PencilLine />
                      </Button>
                      <Button variant="destructive" size="icon" onclick={() => {
                        trpc.internal.games.removeWebhook
                          .mutate({ gameName: selectedGame.name, webhookId: webhook.id })
                          .then(() => {
                            toast.success("Webhook deleted.");
                            fetchGames();
                          })
                          .catch((err) => {
                            console.error(err);
                            toast.error("Failed to delete webhook.", { description: parseErrorMessage(err) });
                          });
                      }}>
                        <TrashIcon />
                      </Button>
                    </td>
                  </tr>
                {/each}
              </tbody>
            </table>
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
      <Button class="w-full" onclick={async () => {
        if (!newGameName || !newGameDisplayName || newGameName.trim() === "" || newGameDisplayName.trim() === "") {
      toast.error("Please fill in all fields.");
      return;
    }
    return await trpc.internal.games.createGame
      .mutate({
        gameName: newGameName,
        displayName: newGameDisplayName,
      })
      .then((game) => {
        toast.success("Game created.");
        newGameName = "";
        newGameDisplayName = "";
        createGameDialogOpen = false;
        return game;
      })
      .catch((err) => {
        console.error(err);
        toast.error("Failed to create game.");
      });
      }}>Create Game</Button>
    </div>
  </DialogContent>
</Dialog>

<Dialog bind:open={createVersionDialogOpen}>
  <DialogContent>
    <div class="flex flex-col items-center rounded-lg justify-center">
      <p class="p-2 text-2xl">Create New Version for {selectedGame?.displayName}</p>
      <Input placeholder="Version String" class="w-full mb-2" bind:value={createVersionVersion} />
      <Button class="w-full" onclick={() => {
        if (!createVersionVersion || createVersionVersion.trim() === "") {
          toast.error("Please enter a version string.");
          return;
        }
        trpc.internal.games.createGameVersion
          .mutate({ gameName: selectedGame?.name ?? "", version: createVersionVersion })
          .then(() => {
            toast.success("Version created.");
            createVersionVersion = "";
            createVersionDialogOpen = false;
            fetchGames();
          })
          .catch((err) => {
            console.error(err);
            toast.error("Failed to create version.");
          });
      }}>Create Version</Button>
    </div>
  </DialogContent>
</Dialog>

<Dialog bind:open={linkVersionDialogOpen}>
  <DialogContent>
    <div class="flex flex-col items-center rounded-lg justify-center">
      <p class="p-2 text-2xl">Link Versions for {selectedGame?.displayName}</p>
      <Input placeholder="Version ID #1" class="w-full mb-2" bind:value={linkVersionSourceId} />
      <Input placeholder="Version ID #2" class="w-full mb-2" bind:value={linkVersionTargetId} />
      <Button class="w-full" onclick={() => {
        if (!linkVersionSourceId || !linkVersionTargetId) {
          toast.error("Please enter both source and target version IDs.");
          return;
        }
        trpc.internal.games.linkVersions
          .mutate({ gameName: selectedGame?.name ?? "", versionId1: parseInt(linkVersionSourceId), versionId2: parseInt(linkVersionTargetId) })
          .then(() => {
            toast.success("Versions linked.");
            linkVersionSourceId = "";
            linkVersionTargetId = "";
            linkVersionDialogOpen = false;
            fetchGames();
          })
          .catch((err) => {
            console.error(err);
            toast.error("Failed to link versions.");
          });
      }}>Link Versions</Button>
    </div>
  </DialogContent>
</Dialog>

<Dialog bind:open={createWebhookDialogOpen}>
  <DialogContent>
    <div class="flex flex-col items-center rounded-lg justify-center">
      <p class="p-2 text-2xl">Create New Webhook for {selectedGame?.displayName}</p>
      <Input placeholder="Webhook URL" class="w-full mb-2" bind:value={newWebhookUrl} />
      <Select.Root type="multiple" bind:value={newWebhookTypes}>
        <Label class="mb-2">Log Types</Label>
        <Select.Trigger class="w-full">{newWebhookTypes.length > 0 ? newWebhookTypes.join(", ") : "Select log types..."}</Select.Trigger>
        <Select.Content>
          {#each Object.values(WebhookLogType) as item}
            <Select.Item value={item}>{item}</Select.Item>
          {/each}
        </Select.Content>
      </Select.Root>
      <div class="flex flex-row items-center gap-2 mt-2">
        <Checkbox bind:checked={newWebhookIsAsset} id="isAsset" />
        <Label for="isAsset">Is Asset Webhook</Label>
      </div>
      <Button class="w-full mt-4" onclick={() => {
        if (!newWebhookUrl || newWebhookUrl.trim() === "") {
          toast.error("Please enter a webhook URL.");
          return;
        }
        if (newWebhookTypes.length === 0) {
          toast.error("Please select at least one log type.");
          return;
        }
        trpc.internal.games.addWebhook
          .mutate({ gameName: selectedGame?.name ?? "", url: newWebhookUrl, types: newWebhookTypes, isAssetWebhook: newWebhookIsAsset })
          .then(() => {
            toast.success("Webhook created.");
            newWebhookUrl = "";
            newWebhookTypes = [];
            newWebhookIsAsset = false;
            createWebhookDialogOpen = false;
            fetchGames();
          })
          .catch((err) => {
            console.error(err);
            toast.error("Failed to create webhook.", { description: parseErrorMessage(err) });
          });
      }}>Create Webhook</Button>
    </div>
  </DialogContent>
</Dialog>

<style>
  table {
    width: 80%;
    border: #2c2c2c80 solid 1px;
    border-radius: 0.5rem;
  }

  tr,
  td,
  th {
    padding: 0.5rem;
    text-align: center;
  }

  thead {
    font-weight: bold;
    padding: 0.5rem;
  }

  th {
    background-color: #2c2c2c80;
  }
  th:first-child {
    border-top-left-radius: 0.5rem;
  }
  th:last-child {
    border-top-right-radius: 0.5rem;
  }
</style>
