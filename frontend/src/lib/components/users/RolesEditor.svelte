<script lang="ts">
  import { toast } from "svelte-sonner";
  import { UserPermissions } from "../../scripts/from_backend/DBExtras";
  import { parseErrorMessage, trpc } from "../../scripts/utils/api";
  import * as Accordion from "../../shadcn/components/ui/accordion";
  import { Button } from "../../shadcn/components/ui/button";
  import { Checkbox } from "../../shadcn/components/ui/checkbox";
  import { Dialog, DialogContent } from "../../shadcn/components/ui/dialog";
  import { Label } from "../../shadcn/components/ui/label";
  import { getRolesCategories } from "../../scripts/utils/stylizer";

  let {
    permObj = $bindable({
      sitewidePermissions: [],
      perGamePermissions: {},
    }),
    userId = $bindable(""),
    enableSend = $bindable(false),
    availableGameNames = [],
    onSubmit,
  }: {
    permObj?: {
      sitewidePermissions: UserPermissions[];
      perGamePermissions: Record<string, UserPermissions[]>;
    };
    userId: number | string;
    enableSend?: boolean;
    availableGameNames?: { name: string; displayName: string }[];
    onSubmit?: () => void;
  } = $props();

  let roleAddGameDialogOpen = $state(false);
  let userName = $state("");

  function fetchUserRoles() {
    let parse = parseInt(userId as string);
    if (!parse || isNaN(parse)) {
      toast.error("User ID is not set");
      return;
    }
    trpc.v3.user.getUserById
      .query({ id: parse })
      .then((data) => {
        permObj.sitewidePermissions = data.permissions.sitewide;
        permObj.perGamePermissions = data.permissions.perGame;
        enableSend = true;
        userName = data.username;
        toast.success("Roles fetched successfully");
      })
      .catch((err) => {
        toast.error(`Failed to fetch roles: ${parseErrorMessage(err)}`);
      });
  }

  function sendUserRoles() {
    let parse = parseInt(userId as string);
    if (!parse || isNaN(parse)) {
      toast.error("User ID is not set");
      return;
    }
    trpc.internal.admin.user.setRoles
      .mutate({
        userId: parse,
        permissions: {
          sitewide: permObj.sitewidePermissions,
          perGame: permObj.perGamePermissions,
        },
      })
      .then(() => {
        toast.success("Roles updated successfully");
        if (onSubmit) {
          onSubmit();
        }
      })
      .catch((err) => {
        toast.error(`Failed to update roles: ${parseErrorMessage(err)}`);
      });
  }
</script>

<div class="flex flex-col w-full">
  <div class="flex flex-row justify-end items-center my-2 gap-2">
    <p class="text-xs text-muted-foreground ml-2 mr-auto">Editing {userName ? `${userName} | ` : ``} ID: {userId}</p>
    <Button size="sm" variant={enableSend ? `ghost` : `outline`} onclick={fetchUserRoles}>Fetch Roles</Button>
    <Button size="sm" variant="ghost" onclick={() => (roleAddGameDialogOpen = true)}>Add Game</Button>
  </div>
  <Accordion.Root type="single" class="w-full max-h-96 overflow-y-scroll" value="sitewide">
    <Accordion.Item value="sitewide" class="border rounded-md">
      <Accordion.Trigger class="bg-secondary p-2 rounded-t-md w-full text-left">Sitewide Permissions</Accordion.Trigger>
      <Accordion.Content class="p-2">
        <div class="flex flex-row flex-wrap gap-2 m-2">
          {#each getRolesCategories() as items}
            <div class="flex flex-col w-full gap-1">
              <p class="text-sm text-muted-foreground">{items[0]}</p>
              <div class="flex flex-row flex-wrap gap-2">
                {#each items[1] as item}
                  <div class="flex flex-row items-center gap-1">
                    <Checkbox
                      bind:checked={
                        () => {
                          return permObj.sitewidePermissions.includes(item);
                        },
                        (val) => {
                          if (val) {
                            permObj.sitewidePermissions = [...permObj.sitewidePermissions, item];
                          } else {
                            permObj.sitewidePermissions = permObj.sitewidePermissions.filter((perm) => perm !== item);
                          }
                        }
                      }
                      id={`sw_${item}`} />
                    <Label for={`sw_${item}`}>{item}</Label>
                  </div>
                {/each}
              </div>
            </div>
          {/each}
        </div>
      </Accordion.Content>
    </Accordion.Item>
    {#each Object.keys(permObj.perGamePermissions) as game}
      <Accordion.Item value={game} class="border rounded-md mb-2">
        <Accordion.Trigger class="bg-secondary p-2 rounded-t-md w-full text-left">{availableGameNames.find((agv) => agv.name == game)?.displayName ?? game} Permissions</Accordion.Trigger>
        <Accordion.Content class="p-2">
          <div class="flex flex-row flex-wrap gap-2 m-2">
            {#each Object.values(UserPermissions).filter((i) => !i.startsWith(`cos_`) && !i.startsWith(`secret`)) as item}
              <div class="flex flex-row items-center gap-1">
                <Checkbox
                  bind:checked={
                    () => {
                      return permObj.perGamePermissions[game]?.includes(item) ?? false;
                    },
                    (val) => {
                      if (val) {
                        permObj.perGamePermissions = {
                          ...permObj.perGamePermissions,
                          [game]: [...(permObj.perGamePermissions[game] ?? []), item],
                        };
                      } else {
                        permObj.perGamePermissions = {
                          ...permObj.perGamePermissions,
                          [game]: permObj.perGamePermissions[game]?.filter((perm) => perm !== item) ?? [],
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
  <Button class="mt-4 mb-2 w-full" onclick={sendUserRoles} disabled={!enableSend}>Update Roles</Button>
</div>

{#if roleAddGameDialogOpen}
  <Dialog bind:open={roleAddGameDialogOpen}>
    <DialogContent>
      <div class="flex flex-col items-center rounded-lg justify-center flex-wrap">
        <p class="p-2 text-2xl">Add Game to pergame</p>
        {#each availableGameNames as g}
          {#if !Object.keys(permObj.perGamePermissions).includes(g.name)}
            <Button
              class=" mb-2"
              onclick={() => {
                permObj.perGamePermissions = {
                  ...permObj.perGamePermissions,
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
