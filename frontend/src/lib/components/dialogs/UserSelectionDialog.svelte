<script lang="ts">
  import * as Dialog from "$shadcn/components/ui/dialog";
  import type { UserApiV3 } from "$lib/scripts/api/DBTypes";
  import { Button } from "$shadcn/components/ui/button";
  import * as Command from "$shadcn/components/ui/command";
  import debounce from "debounce";
  import { trpc } from "$lib/scripts/utils/api";


  let open = $state(false);
  let onSubmit: (user: UserApiV3) => void;
  export function showDialog(onSubmitCallback: (user: UserApiV3) => void) {
    onSubmit = onSubmitCallback;
    open = true;
  }

  let searchQuery = $state("");
  let searchResults = $state<UserApiV3[]>([]);

  // only search after the user has stopped typing for 300ms

  function searchUsers() {
    trpc.v3.user.searchUsers.query({query: searchQuery}).then(results => {
      searchResults = results;
    });
  }

    
</script>

<Dialog.Root bind:open={open}>
  <Dialog.Content>
    <Dialog.Header>
      <Dialog.Title>Select User</Dialog.Title>
    </Dialog.Header>
    <div>
      <Command.Root shouldFilter={false} oninput={debounce(searchUsers, 500)}>
        <Command.Input placeholder="Search for a user..." bind:value={searchQuery} />
        <Command.List>
          <Command.Empty>No results found.</Command.Empty>
          {#each searchResults as user (user.id)}
            <Command.Item onSelect={() => {onSubmit(user); open = false}}>
              <div class="flex items-center gap-2">
                <img src={user.avatarUrl} alt="{user.displayName} Avatar" class="w-6 h-6 rounded-full" />
                <span>{user.displayName}</span>
              </div>
            </Command.Item>
          {/each}
        </Command.List>
      </Command.Root>
    </div>
    <Dialog.Footer>
      <Button variant="outline">Cancel</Button>
      <Button>Confirm</Button>
    </Dialog.Footer>
  </Dialog.Content>
</Dialog.Root>
