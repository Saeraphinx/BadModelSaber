<script lang="ts">
  import { toast } from "svelte-sonner";
  import { UserPermissions, type UserApiV3 } from "../../scripts/from_backend/DBExtras";
  import { parseErrorMessage, trpc } from "../../scripts/utils/api";
  import * as Accordion from "../../shadcn/components/ui/accordion";
  import { Button } from "../../shadcn/components/ui/button";
  import { Checkbox } from "../../shadcn/components/ui/checkbox";
  import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "../../shadcn/components/ui/dialog";
  import { Label } from "../../shadcn/components/ui/label";
  import { getRolesCategories } from "../../scripts/utils/stylizer";

  let isOpen = $state(false);
  let roleAddGameDialogOpen = $state(false);
  let user: UserApiV3 | null = $state(null);
  let availableGameNames: { name: string; displayName: string }[] = $state([]);
  let permObj: {
    sitewide: UserPermissions[];
    perGame: Record<string, UserPermissions[]>;
  } = $state({
    sitewide: [],
    perGame: {},
  });

  export async function showDialog(p_user: UserApiV3, p_availableGameNames?: { name: string; displayName: string }[]) {
    user = p_user;
    if (p_availableGameNames) {
      availableGameNames = p_availableGameNames;
    } else {
      await trpc.v3.games.getGames.query().then((games) => {
        availableGameNames = games.map((g) => ({ name: g.name, displayName: g.displayName }));
      }).catch((err) => {
        toast.error(`Failed to fetch available games: ${parseErrorMessage(err)}`);
      });
    }
    permObj = user.permissions;
    isOpen = true;
  }

  function sendUserRoles() {
    trpc.internal.admin.user.setRoles
      .mutate({
        userId: user?.id as number,
        permissions: permObj,
      })
      .then(() => {
        toast.success("Roles updated successfully");
        isOpen = false;
        user = null;
      })
      .catch((err) => {
        toast.error(`Failed to update roles: ${parseErrorMessage(err)}`);
      });
  }
</script>

{#snippet checkboxes(rolesCategories: Map<string, UserPermissions[]>, isSitewide = true, gameName = "", idPrefix = "sw")}
  <Accordion.Item value={idPrefix} class="border rounded-md">
    <Accordion.Trigger class="bg-secondary p-2 rounded-t-md w-full text-left">{isSitewide ? `Sitewide` : availableGameNames.find((agv) => agv.name == gameName)?.displayName ?? gameName} Permissions</Accordion.Trigger>
    <Accordion.Content class="p-2">
      <div class="flex flex-row flex-wrap gap-2 m-2">
        {#each rolesCategories as items}
          <div class="flex flex-col w-full gap-1">
            <p class="text-sm text-muted-foreground capitalize">{items[0]}</p>
            <div class="flex flex-row flex-wrap gap-2">
              {#each items[1] as item}
                <div class="flex flex-row items-center gap-1">
                  <Checkbox
                    bind:checked={
                      () => {
                        if (isSitewide) {
                          return permObj.sitewide.includes(item);
                        } else {
                          return permObj.perGame[gameName]?.includes(item) ?? false;
                        }
                      },
                      (val) => {
                        if (isSitewide) {
                          if (val) {
                            permObj.sitewide = [...permObj.sitewide, item];
                          } else {
                            permObj.sitewide = permObj.sitewide.filter((perm) => perm !== item);
                          }
                        } else {
                          if (val) {
                            permObj.perGame = {
                              ...permObj.perGame,
                              [gameName]: [...(permObj.perGame[gameName] ?? []), item],
                            };
                          } else {
                            permObj.perGame = {
                              ...permObj.perGame,
                              [gameName]: permObj.perGame[gameName]?.filter((perm) => perm !== item) ?? [],
                            };
                          }
                        }
                      }
                    }
                    id={`${idPrefix}_${item}`} />
                  <Label for={`${idPrefix}_${item}`}>{item}</Label>
                </div>
              {/each}
            </div>
          </div>
        {/each}
      </div>
    </Accordion.Content>
  </Accordion.Item>
{/snippet}

<Dialog bind:open={isOpen}>
  <DialogContent class="min-w-lg gap-2">
    <DialogHeader>
      <DialogTitle>Edit Roles for {user?.displayName}</DialogTitle>
    </DialogHeader>
    <div class="flex flex-col w-full">
      <div class="flex flex-row justify-end items-center mb-2 gap-2">
        <p class="text-xs text-muted-foreground mr-auto">Editing {user?.username} ID: {user?.id}</p>
        <Button size="sm" variant="ghost" onclick={() => (roleAddGameDialogOpen = true)}>Add Game</Button>
      </div>
      <Accordion.Root type="single" class="w-full max-h-96 scrollbar-thin overflow-y-scroll mb-2" value="sw">
        {@render checkboxes(getRolesCategories(), true, "", "sw")}
        {#each Object.keys(permObj.perGame) as game}
          {@render checkboxes(getRolesCategories(Object.values(UserPermissions).filter((i) => !i.startsWith(`cos_`) && !i.startsWith(`secret`)  && i !== `game_create` && !i.includes(`user`) && !i.includes(`admin`))), false, game, `pg_${game}`)}
        {/each}
      </Accordion.Root>
      <DialogFooter>
        <Button size="sm" variant="outline" onclick={() => (isOpen = false)}>Cancel</Button>
        <Button size="sm" onclick={sendUserRoles}>Update Roles</Button>
      </DialogFooter>
    </div>
  </DialogContent>
</Dialog>

{#if roleAddGameDialogOpen}
  <Dialog bind:open={roleAddGameDialogOpen}>
    <DialogContent>
      <div class="flex flex-col items-center rounded-lg justify-center flex-wrap">
        <p class="p-2 text-2xl">Add Game to pergame</p>
        {#each availableGameNames as g}
          {#if !Object.keys(permObj.perGame).includes(g.name)}
            <Button
              class=" mb-2"
              onclick={() => {
                permObj.perGame = {
                  ...permObj.perGame,
                  [g.name]: [],
                };
                roleAddGameDialogOpen = false;
              }}>{g.displayName}</Button>
          {/if}
        {/each}
      </div>
    </DialogContent>
  </Dialog>
{/if}
