<script lang="ts">
  import "../app.css";
  import * as NavigationMenu from "$shadcn/components/ui/navigation-menu/index.js";
  import * as DropdownMenu from "$shadcn/components/ui/dropdown-menu/index.js";
  import { getContext, onMount, setContext } from "svelte";
  import { Button, buttonVariants } from "$shadcn/components/ui/button";
  import * as Avatar from "$shadcn/components/ui/avatar";
  import {
    BellDotIcon,
    BellIcon,
    FileBadgeIcon,
    GitBranchIcon,
    Link2Icon,
    LogInIcon,
    LogOutIcon,
    Menu,
    MessageCircleQuestionIcon,
    PlusIcon,
    Settings,
    SunIcon,
    TrafficConeIcon,
    UserIcon,
    SettingsIcon,
    SunMoonIcon,
    LanguagesIcon,
  } from "@lucide/svelte";
  import { MediaQuery } from "svelte/reactivity";
  import * as Popover from "$shadcn/components/ui/popover";
  import { page } from "$app/state";
  import { Toaster } from "$shadcn/components/ui/sonner";
  import { toast, type ExternalToast } from "svelte-sonner";
  import { env } from "$env/dynamic/public";
  import { UserPermissions, type AlertPublicAPIv3 } from "$lib/scripts/api/DBTypes";
  import Separator from "$shadcn/components/ui/separator/separator.svelte";
  import { Badge } from "$shadcn/components/ui/badge";
  import * as Sheet from "$shadcn/components/ui/sheet";
  import Alert from "$lib/components/generic/Alert.svelte";
  import { Switch } from "$shadcn/components/ui/switch";
  import { Label } from "$shadcn/components/ui/label";
  import ScrollArea from "$shadcn/components/ui/scroll-area/scroll-area.svelte";
  import { trpc } from "$lib/scripts/utils/api";
  import { invalidateAll } from "$app/navigation";
  import { getLocale } from "$lib/paraglide/runtime";
  import { m } from "$lib/paraglide/messages";
  import { Spinner } from "$shadcn/components/ui/spinner";

  let { data, children } = $props();
  let theme: `system` | `light` | `dark` = $state("system");
  let showFullBar = new MediaQuery("min-width: 769px");
  let isLoggedIn = $derived(!!(data.user && data.user.id));

  // #region KonamiListener
  onMount(() => {
    if (data.user && data.user.id && !data.user.roles.includes(UserPermissions.Create_Assets)) return;
    const konamiCode = ["ArrowUp", "ArrowUp", "ArrowDown", "ArrowDown", "ArrowLeft", "ArrowRight", "ArrowLeft", "ArrowRight", "b", "a"];

    let inputSequence: string[] = [];

    const handleKeydown = (event: KeyboardEvent) => {
      if (event.repeat) return; // Ignore repeated key presses
      if (!konamiCode.includes(event.key)) {
        inputSequence = []; // Reset if an invalid key is pressed
        return;
      }

      inputSequence.push(event.key);
      if (inputSequence.length > konamiCode.length) {
        inputSequence.shift();
      }

      if (inputSequence.join("") === konamiCode.join("")) {
        if (!data.user || !data.user.id) {
          toast.error("You must be logged in to activate this feature.", {
            duration: 5000,
            closeButton: true,
            dismissable: true,
          });
          return;
        }
        if (data.user.roles.includes(UserPermissions.View_Pending_Assets)) {
          toast.info("You have already activated the secret features.", {
            description: "If you want to disable them, disable them in your user settings.",
            duration: 5000,
            closeButton: true,
            dismissable: true,
          });
          return;
        }
        inputSequence = []; // Reset the sequence after activation
        toast.info("Secret features unlocked!", {
          description: "If you enable these features, you will be able to access hidden content and features on ModelSaber. ModelSaber is not responsible for any damage caused by this content.",
          duration: 60000,
          dismissable: true,
          action: {
            label: "Enable",
            onClick: () => {
              trpc.konamiRouter.konami
                .mutate(`add`)
                .then(() => {
                  toast.success("Secret features enabled!", {
                    description: "You can now access hidden content and features on ModelSaber. Use responsibly!",
                    closeButton: true,
                  });
                  invalidateAll(); // Refresh user data to reflect new roles
                })
                .catch((error) => {
                  toast.error("Failed to enable secret features.", {
                    description: error.message,
                  });
                });
              console.log("Secret features enabled!");
            },
          },
        });
        //console.log("Konami Code activated!");
      }
    };

    document.addEventListener("keydown", handleKeydown);

    return () => {
      document.removeEventListener("keydown", handleKeydown);
    };
  });

  function removeSecret() {
    trpc.konamiRouter.konami
      .mutate(`remove`)
      .then(() => {
        toast.info("Secret features disabled!", {
          description: "Access to hidden content and features has been revoked.",
        });
        invalidateAll(); // Refresh user data
      })
      .catch((error) => {
        toast.error("Failed to disable secret features.", {
          description: error.message,
        });
      });
  }
  // #endregion KonamiListener

  // #region Theme
  onMount(() => {
    theme = (localStorage.getItem("theme") as typeof theme) || "system";
    handleThemeChange();
    document.documentElement.classList.remove("unrendered");
  });

  function handleThemeChange() {
    if (theme === "system") {
      if (window.matchMedia("(prefers-color-scheme: dark)").matches) {
        document.documentElement.classList.add("dark");
      } else {
        document.documentElement.classList.remove("dark");
      }
    } else {
      if (theme === "dark") {
        document.documentElement.classList.add("dark");
      } else {
        document.documentElement.classList.remove("dark");
      }
    }
    localStorage.setItem("theme", theme);
  }
  // #endregion Theme

  // #region Alerts
  let allAlerts = $state<AlertPublicAPIv3[]>(data.alerts);
  let unreadAlerts = $derived(allAlerts.filter((alert) => !alert.read));
  let isPendingAlerts = $derived(unreadAlerts.length > 0);
  let openAlerts = $state(false);
  let showRead = $state(false);
  let isLoadingAlerts = $state(false);
  async function updateAlerts() {
    // this is honestly a fucking mess but its what works for now
    isLoadingAlerts = true;
    trpc.alertsRouter.getAlerts
      .query({ read: `all` })
      .then((val) => {
        allAlerts = val;
        isLoadingAlerts = false;
      })
      .catch((error) => {
        toast.error("Failed to fetch read alerts.", {
          description: error.message,
        });
        return [];
      });
  }
  // #endregion Alerts

  // #region Toasts
  // Alert count toast
  onMount(() => {
    if (isPendingAlerts) {
      toast.info(`You have ${allAlerts.length} unread alert${allAlerts.length == 1 ? `` : `s`}.`, {
        description: "",
        duration: 10000,
        closeButton: true,
        dismissable: true,
        action: {
          label: "View",
          onClick: () => {
            openAlerts = true;
          },
        },
      });
    }
  });

  // Layout Error Toasts
  onMount(() => {
    for (const pendingToast of data.pendingToasts || []) {
      let options: ExternalToast = {
        description: pendingToast.description,
        closeButton: true,
        dismissable: true,
      };
      if (pendingToast.type === "info") {
        toast.info(pendingToast.title, options);
      } else if (pendingToast.type === "success") {
        toast.success(pendingToast.title, options);
      } else if (pendingToast.type === "error") {
        toast.error(pendingToast.title, options);
      }
    }
  });
  // #endregion Toasts

  let currentLocale = getLocale();
  const availableLocales = [["en", "English"]];

  const links = [
    { href: "/", label: m["layout.navbar.home"](), target: undefined },
    { href: "/assets", label: m["layout.navbar.assets"](), target: undefined },
    { href: "https://bsmg.wiki/models", label: m["layout.navbar.modelWiki"](), target: "_blank" },
  ];
</script>

{#snippet navbar_main(orientation = "vertical")}
  <NavigationMenu.Root>
    <NavigationMenu.List class="flex {orientation === 'vertical' ? 'flex-col' : 'flex-row'}">
      {#each links as link}
        <NavigationMenu.Item>
          <NavigationMenu.Link href={link.href} target={link.target} class="text-base text-nowrap">
            {link.label}
          </NavigationMenu.Link>
        </NavigationMenu.Item>
      {/each}
    </NavigationMenu.List>
  </NavigationMenu.Root>
{/snippet}

<!-- #region Page title & favicon -->
<svelte:head>
  <title>{page.data.pageMetadata?.title || `ModelSaber`}</title>
  <link rel="icon" href="/favicon.png" />
</svelte:head>

<div>
  <!-- #region top bar -->
  <div class="flex w-auto flex-row text-base justify-between">
    <!-- Logo -->
    <a href="/">
      <div class="flex items-center justify-center md:w-32 h-16 md:ml-16 ml-4 md:p-4">
        <img src="/modelsaber-logo-web.svg" alt="ModelSaber Logo" class="h-8 w-8 mr-2" />
        <span class="text-xl font-bold">{m.name()}</span>
      </div>
    </a>
    <!-- Navigation Bar -->
    <div class="flex p-4 pt-3 justify-center">
      {#if showFullBar.current}
        {@render navbar_main("horizontal")}
      {/if}
    </div>
    <div class="flex items-center justify-end md:w-32 h-16 md:mr-16 mr-4 md:p-4 gap-0.5">
      <!-- Hamburger menu for Small Screens -->
      {#if !showFullBar.current}
        <Popover.Root>
          <Popover.Trigger>
            {#snippet child()}
              <Button variant="ghost" size="icon" class="text-base">
                <Menu />
              </Button>
            {/snippet}
          </Popover.Trigger>
          <Popover.Content class="flex flex-col items-center justify-center w-auto">
            {@render navbar_main("vertical")}
            <Separator class="my-2 w-full" />
          </Popover.Content>
        </Popover.Root>
      {/if}
      <!-- User Avatar or Login Button -->
      <DropdownMenu.Root>
        <DropdownMenu.Trigger class="p-2 rounded-full hover:bg-accent transition-colors duration-300">
          {#if data.user}
            <Avatar.Root>
              <Avatar.Image src={data.user.avatarUrl} alt={data.user.displayName} />
              <Avatar.Fallback>{data.user.displayName}</Avatar.Fallback>
            </Avatar.Root>
          {:else}
            <SettingsIcon />
          {/if}
        </DropdownMenu.Trigger>
        <DropdownMenu.Content class="mr-10 flex flex-col">
          {#if data.user}
            <a href="/users/me">
              <DropdownMenu.Item>
                <UserIcon />
                {m["layout.userMenu.profile"]()}
              </DropdownMenu.Item>
            </a>
            <button onclick={() => (openAlerts = true)}>
              <DropdownMenu.Item>
                <BellIcon />
                {m["layout.userMenu.alerts"]()}
                {#if isPendingAlerts}
                  <Badge class="ml-1" variant="destructive">
                    {allAlerts.length}
                  </Badge>
                {/if}
              </DropdownMenu.Item>
            </button>
            <a href="/requests">
              <DropdownMenu.Item>
                <MessageCircleQuestionIcon />
                {m["layout.userMenu.requests"]()}
              </DropdownMenu.Item>
            </a>
            {#if data.user.roles.includes(UserPermissions.Manage_NonMod_Users) || data.user.roles.includes(UserPermissions.Manage_All_Users)}
              <a href="/admin">
                <DropdownMenu.Item>
                  <Settings />
                  {m["layout.userMenu.adminPanel"]()}
                </DropdownMenu.Item>
              </a>
            {/if}
            {#if data.user.roles.includes(UserPermissions.View_Pending_Assets)}
              <button onclick={removeSecret}>
                <DropdownMenu.Item>
                  <TrafficConeIcon class="text-orange-500" />
                  {m["layout.userMenu.disableSecretFeatures"]()}
                </DropdownMenu.Item>
              </button>
            {/if}
            {#if data.user.roles.includes(UserPermissions.Create_Assets)}
              <a href="/create">
                <DropdownMenu.Item>
                  <PlusIcon />
                  {m["layout.userMenu.createAsset"]()}
                </DropdownMenu.Item>
              </a>
            {/if}
            <DropdownMenu.Separator />
          {/if}
          <p class="p-1 text-sm">{m["layout.userMenu.options"]()}</p>
          <DropdownMenu.Sub>
            <DropdownMenu.SubTrigger>
              <SunMoonIcon />
              {m["layout.userMenu.theme"]()}
            </DropdownMenu.SubTrigger>
            <DropdownMenu.SubContent class="">
              <DropdownMenu.RadioGroup bind:value={theme} onValueChange={handleThemeChange}>
                <DropdownMenu.Label>{m["layout.userMenu.theme"]()}</DropdownMenu.Label>
                <DropdownMenu.RadioItem closeOnSelect={false} value="system">{m["layout.userMenu.system"]()}</DropdownMenu.RadioItem>
                <DropdownMenu.RadioItem closeOnSelect={false} value="dark">{m["layout.userMenu.dark"]()}</DropdownMenu.RadioItem>
                <DropdownMenu.RadioItem closeOnSelect={false} value="light">{m["layout.userMenu.light"]()}</DropdownMenu.RadioItem>
              </DropdownMenu.RadioGroup>
            </DropdownMenu.SubContent>
          </DropdownMenu.Sub>
          <DropdownMenu.Sub>
            <DropdownMenu.SubTrigger>
              <LanguagesIcon />
              {m["layout.userMenu.language"]()}
            </DropdownMenu.SubTrigger>
            <DropdownMenu.SubContent class="">
              <DropdownMenu.RadioGroup
                value={currentLocale}
                onValueChange={(val) => {
                  setContext("locale", val);
                }}>
                <DropdownMenu.Label>{m["layout.userMenu.language"]()}</DropdownMenu.Label>
                {#each availableLocales as [code, name]}
                  <DropdownMenu.RadioItem closeOnSelect={true} value={code}>{name}</DropdownMenu.RadioItem>
                {/each}
              </DropdownMenu.RadioGroup>
            </DropdownMenu.SubContent>
          </DropdownMenu.Sub>
          <DropdownMenu.Separator />
          {#if isLoggedIn}
            <button
              onclick={() => {
                trpc.authRouter.logout.mutate({}).then(() => {
                  invalidateAll();
                });
              }}>
              <DropdownMenu.Item>
                <LogOutIcon class="text-red-400" />
                {m["layout.userMenu.logout"]()}
              </DropdownMenu.Item>
            </button>
          {:else}
            <button
              onclick={async () => {
                let url = await trpc.authRouter.discordAuthInit.query({
                  redirect: `${env.PUBLIC_BASE_URL}${page.url.pathname}`,
                });
                window.location.href = url.url;
              }}>
              <DropdownMenu.Item>
                <LogInIcon />
                {m["layout.userMenu.login"]()}
              </DropdownMenu.Item>
            </button>
          {/if}
          <DropdownMenu.Separator />
          <p class="text-xs text-muted-foreground text-center p-1"><a href="https://github.com/Saeraphinx/BadModelSaber" target="_blank">{m["layout.userMenu.modelsaberOpenSource"]()}</a></p>
          {#if data.user && data.user.roles.includes(UserPermissions.Administative_Tasks)}
            <DropdownMenu.Separator />
            <span class="text-xs text-muted-foreground text-center p-1">
              Administrative Information<br />
              Logged in as {data.user.displayName}<br />
              {data.user.id}
            </span>
          {/if}
        </DropdownMenu.Content>
      </DropdownMenu.Root>
    </div>
  </div>
  <div class="px-4 text-base text-foreground">
    {@render children()}
  </div>
</div>

<!-- #region Alert Sidebar -->
<Sheet.Root bind:open={openAlerts}>
  <Sheet.Content class="grid grid-rows-[auto_1fr_auto] h-full">
    <Sheet.Header>
      <Sheet.Title class="text-lg font-semibold">{m["layout.userMenu.alerts"]()}</Sheet.Title>
      <div class="flex flex-row justify-between items-center">
        <Sheet.Description class="text-sm flex flex-row text-gray-500">
          {#if !isLoadingAlerts}
            {#if showRead}
              {m["layout.alertSidebar.readAlerts"]({ count: allAlerts.length })}
            {:else}
              {m["layout.alertSidebar.unreadAlerts"]({ count: unreadAlerts.length })}
            {/if}
          {/if}
        </Sheet.Description>
        <div class="flex items-center space-x-2">
          <Switch id="show-read" bind:checked={showRead} onCheckedChange={updateAlerts} />
          <Label for="show-read">{m["layout.alertSidebar.showRead"]()}</Label>
        </div>
      </div>
    </Sheet.Header>
    <ScrollArea class="mx-4 min-h-0">
      {#if isLoadingAlerts}
        <div class="flex flex-row items-center justify-center gap-2">
          <Spinner class="text-gray-500"/>
          <p class="text-gray-500">Loading...</p>
        </div>
      {:else if showRead}
        {#if allAlerts.length > 0}
          {#each allAlerts as alert}
            <Alert
              {alert}
              deleteFromArray={() => {
                allAlerts = allAlerts.filter((a) => a.id !== alert.id);
              }}
              class="mb-2" />
          {/each}
        {:else}
          <p class="text-gray-500">{m["layout.alertSidebar.noAlertsAvailable"]()}</p>
        {/if}
      {:else if unreadAlerts.length > 0}
        {#each unreadAlerts as alert}
          <Alert
            {alert}
            deleteFromArray={() => {
              // mark alert as read on client
              unreadAlerts = unreadAlerts.map((a) => {
                if (a.id === alert.id) {
                  return {
                    ...a,
                    read: true,
                  };
                } else {
                  return a;
                }
              });
            }}
            class="mb-2" />
        {/each}
      {:else}
        <div class="flex justify-center items-center gap-2">
          <p class="text-gray-500">{m["layout.alertSidebar.noUnreadAlerts"]()}</p>
        </div>
      {/if}
    </ScrollArea>
    <Sheet.Footer>
      <Sheet.Close class={buttonVariants({ variant: "outline" })}>{m["dialogs.close"]()}</Sheet.Close>
    </Sheet.Footer>
  </Sheet.Content>
</Sheet.Root>
<!-- #endregion -->

<Toaster
  richColors={true}
  {theme}
  position="top-right"
  toastOptions={{
    closeButton: true,
    duration: 5000,
    classes: {
      toast: "",
      title: "font-bold",
    },
  }} />
