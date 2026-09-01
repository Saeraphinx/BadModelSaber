<script lang="ts">
  import "../app.css";
  import * as NavigationMenu from "$shadcn/components/ui/navigation-menu/index.js";
  import * as DropdownMenu from "$shadcn/components/ui/dropdown-menu/index.js";
  import { onMount, setContext } from "svelte";
  import { buttonVariants } from "$shadcn/components/ui/button";
  import * as Avatar from "$shadcn/components/ui/avatar";
  import { BellIcon, LogInIcon, LogOutIcon, Menu, MessageCircleQuestionIcon, PlusIcon, Settings, TrafficConeIcon, UserIcon, SettingsIcon, LanguagesIcon, FolderGit2Icon, FileAxis3DIcon, Server } from "@lucide/svelte";
  import { MediaQuery } from "svelte/reactivity";
  import * as Popover from "$shadcn/components/ui/popover";
  import { page } from "$app/state";
  import { Toaster } from "$shadcn/components/ui/sonner";
  import { toast, type ExternalToast } from "svelte-sonner";
  import { env } from "$env/dynamic/public";
  import { UserPermissions, type AlertApiV3, availableLocales } from "$lib/scripts/from_backend/DBExtras";
  import { Badge } from "$shadcn/components/ui/badge";
  import * as Sheet from "$shadcn/components/ui/sheet";
  import Alert from "$lib/components/generic/Alert.svelte";
  import { Switch } from "$shadcn/components/ui/switch";
  import { Label } from "$shadcn/components/ui/label";
  import ScrollArea from "$shadcn/components/ui/scroll-area/scroll-area.svelte";
  import { invalidateAll, beforeNavigate, afterNavigate } from "$app/navigation";
  import { Spinner } from "$shadcn/components/ui/spinner";
  import { checkRoles } from "$lib/scripts/utils/checkRoles";
  import { handleTrpcErrorWithToast, parseErrorMessage } from "$lib/scripts/utils/api";
  import { m } from "$lib/paraglide/messages";
  import { getLocale, setLocale } from "$lib/paraglide/runtime";


  const { data: _internal, children } = $props();
  const { user, alertCount, pendingToasts, trpc } = $derived(_internal);
  
  let showFullBar = new MediaQuery("min-width: 769px");
  let showDevbar = new MediaQuery(`min-height: 550px`);
  let isLoggedIn = $derived(!!(user && user.id));

  // #region KonamiListener
  onMount(() => {
    const konamiCode = ["ArrowUp", "ArrowUp", "ArrowDown", "ArrowDown", "ArrowLeft", "ArrowRight", "ArrowLeft", "ArrowRight", "b", "a"];

    let inputSequence: string[] = [];

    const handleKeydown = (event: KeyboardEvent) => {
      // Skip if user is banned or not logged in
      if (!isLoggedIn && checkRoles(user, [UserPermissions.C_Banned])) return;

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
        if (!isLoggedIn) {
          toast.error(m[`toasts.secretFeatures.mustBeLoggedIn`](), {
            duration: 5000,
            closeButton: true,
            dismissable: true,
          });
          return;
        }
        if (checkRoles(user, [UserPermissions.Secret_Features])) {
          toast.info(m[`toasts.secretFeatures.alreadyEnabled`](), {
            description: m[`toasts.secretFeatures.alreadyEnabledDescription`](),
            duration: 5000,
            closeButton: true,
            dismissable: true,
          });
          return;
        }
        inputSequence = []; // Reset the sequence after activation
        toast.info(m[`toasts.secretFeatures.unlocked`](), {
          description: m[`toasts.secretFeatures.unlockedDescription`](),
          duration: 60000,
          dismissable: true,
          action: {
            label: "Enable",
            onClick: () => {
              trpc.internal.updateThings.user.toggleSecretFeatures
                .mutate({ enabled: true })
                .then(() => {
                  toast.success(m[`toasts.secretFeatures.enabled`](), {
                    description: m[`toasts.secretFeatures.enabledDescription`](),
                    closeButton: true,
                  });
                  window.location.reload(); // do a full-on reload due to the role changes potentially breaking stuff
                })
                .catch(handleTrpcErrorWithToast(m[`toasts.error.generic`]()));
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
    trpc.internal.updateThings.user.toggleSecretFeatures
      .mutate({ enabled: false })
      .then(() => {
        toast.info(m[`toasts.secretFeatures.disabled`](), {
          description: m[`toasts.secretFeatures.disabledDescription`](),
        });
        invalidateAll(); // Refresh user data
      })
      .catch(handleTrpcErrorWithToast(m[`toasts.error.generic`]()));
  }
  // #endregion KonamiListener

  // #region Alerts
  let openAlerts = $state(false);
  let showRead = $state(false);
  let allAlerts = $state<AlertApiV3[]>([]);
  let hasGottenAlerts = $state(false);
  let isLoadingAlerts = $state(false);
  let unreadAlertCount = $derived.by(() => {
    return hasGottenAlerts ? allAlerts.filter((alert) => !alert.read).length : alertCount;
  });
  let hasUnreadAlerts = $derived(unreadAlertCount > 0);
  async function updateAlerts() {
    isLoadingAlerts = true;
    await trpc.internal.alerts.getAlerts
      .query({ read: `all` })
      .then((data) => {
        allAlerts = data;
        return data;
      })
      .catch(handleTrpcErrorWithToast(m[`toasts.error.generic`]()))
      .finally(() => {
        isLoadingAlerts = false;
      });
  }
  async function openAlertsSidebar() {
    openAlerts = true;
    hasGottenAlerts = true;
    await updateAlerts();
  }
  // #endregion Alerts

  // #region Toasts
  // Alert count toast
  onMount(() => {
    if (hasUnreadAlerts) {
      toast.info(m[`layout.unreadAlerts`]({ count: unreadAlertCount }), {
        description: "",
        duration: 10000,
        closeButton: true,
        dismissable: true,
        action: {
          label: "View",
          onClick: openAlertsSidebar,
        },
      });
    }
  });

  // Layout Error Toasts
  onMount(() => {
    for (const pendingToast of pendingToasts || []) {
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

  // #region Debug Logging
  let isLoggerConnected = $state(false);
  let loggerSubscription: any;
  function handleLoggerConnection(connect: boolean) {
    if (connect) {
      loggerSubscription = trpc.internal.admin.dev.subscribeAdminLogs.subscribe(undefined, {
        onData(log) {
          let title = `[${log.level.toUpperCase()}] ${new Date().toISOString()}`;
          switch (log.level) {
            case "warn":
              toast.warning(title, { description: log.message, position: "bottom-right", duration: 15000 });
              break;
            case "error":
              toast.error(title, { description: log.message, position: "bottom-right", duration: 30000 });
              break;
            default:
              toast.info(title, { description: log.message, position: "bottom-right", duration: 10000 });
          }
        },
        onError(err) {
          console.error(err);
          toast.error("Failed to subscribe to admin logs.", { description: parseErrorMessage(err), position: "bottom-right" });
        },
        onStarted() {
          isLoggerConnected = true;
          toast.success("Successfully subscribed to admin logs.", { description: "", position: "bottom-right" });
        },
        onStopped() {
          isLoggerConnected = false;
          toast.info("Unsubscribed from admin logs.", { description: "", position: "bottom-right", duration: 30000 });
        },
      });
    } else {
      if (loggerSubscription) {
        loggerSubscription.unsubscribe();
        loggerSubscription = null;
        isLoggerConnected = false;
      }
    }
  }
  // #endregion Debug Logging
  onMount(() => {
    document.documentElement.classList.remove("unrendered");
  });

  const links = [
    { href: "/", label: m[`layout.navbar.home`](), target: undefined },
    {
      href: "",
      label: m[`layout.navbar.mods.modsHeader`](),
      target: undefined,
      children: [
        { href: "/mods", label: m[`layout.navbar.mods.browseMods`]() },
        { href: "https://bsmg.wiki/beginners-guide.html", label: m[`layout.navbar.mods.beatsaberBeginnersGuide`](), target: "_blank" },
        { href: "https://bsmg.wiki/modding", label: m[`layout.navbar.mods.moddersGuide`](), target: "_blank" },
        { href: "https://github.com/Saeraphinx/BadModelSaber/blob/main/mod-approval-guidelines.md", label: m[`layout.navbar.mods.pcApprovalGuide`](), target: "_blank" },
        { href: "/mods/compare", label: m[`layout.navbar.mods.compareVersions`]() },
      ],
    },
    {
      href: "",
      label: m[`layout.navbar.assets.assetsHeader`](),
      target: undefined,
      children: [
        { href: "/assets", label: m[`layout.navbar.assets.browseAssets`]() },
        {
          label: m[`layout.navbar.assets.creationGuide`](),
          href: "https://bsmg.wiki/beginners-guide.html#making-3d-models",
          target: "_blank",
        },
        {
          label: m[`layout.navbar.assets.installationGuide`](),
          href: "https://bsmg.wiki/models/custom-sabers.html",
          target: "_blank",
        },
      ],
    },
    { href: "https://bsmg.wiki", label: m[`layout.navbar.wiki`](), target: "_blank" },
    { href: "https://discord.gg/beatsabermods", label: m[`layout.navbar.discord`](), target: "_blank" },
  ];

  let isNavigating = $state(false);
  beforeNavigate(() => {
    isNavigating = true;
  });
  afterNavigate(() => {
    isNavigating = false;
  });
</script>

{#snippet navbar_main(orientation = "vertical")}
  <NavigationMenu.Root viewport={orientation === "horizontal"}>
    <NavigationMenu.List class="flex justify-center-safe items-center-safe {orientation === 'vertical' ? 'flex-col' : 'flex-row'}">
      {#each links as link}
        <NavigationMenu.Item>
          {#if link.children}
            <NavigationMenu.Trigger class="text-base font-normal p-2 bg-transparent {orientation === `vertical` ? `w-full` : ``}">{link.label}</NavigationMenu.Trigger>
            <NavigationMenu.Content>
              <ul class="grid gap-4 p-2">
                <li>
                  {#each link.children as child}
                    <NavigationMenu.Link href={child.href} target={child.target} class="text-base text-nowrap">
                      {child.label}
                    </NavigationMenu.Link>
                  {/each}
                </li>
              </ul>
            </NavigationMenu.Content>
          {:else}
            <NavigationMenu.Link href={link.href} target={link.target} class="text-base text-nowrap">
              {link.label}
            </NavigationMenu.Link>
          {/if}
        </NavigationMenu.Item>
      {/each}
    </NavigationMenu.List>
  </NavigationMenu.Root>
{/snippet}

<!-- #region Page title & favicon -->
<svelte:head>
  {#if page.data.pageMetadata?.title && page.data.pageMetadata?.title.includes(" - ")}
    <title>{page.data.pageMetadata.title}</title>
  {:else if page.data.pageMetadata?.title}
    <title>{page.data.pageMetadata?.title ? `${page.data.pageMetadata.title} - ${m[`name`]()}` : `${m[`name`]()}`}</title>
  {:else}
    <title>{m[`name`]()}</title>
  {/if}
  <link rel="icon" href="/favicon.png" />
  <!-- OpenGraph -->
  {#if page.data.pageMetadata?.title && page.data.pageMetadata?.title.includes(" - ")}
    <meta property="og:title" content={page.data.pageMetadata.title} />
  {:else if page.data.pageMetadata?.title}
    <meta property="og:title" content={`${page.data.pageMetadata.title} - ${m[`name`]()}`} />
  {:else}
    <meta property="og:title" content={`${m[`name`]()}`} />
  {/if}
  <meta property="og:description" content={page.data.pageMetadata?.description! ?? m[`homepage.subtitle`]()} />
  <meta property="og:image" content={page.data.pageMetadata?.imageUrl ?? `${env.PUBLIC_BASE_URL}/modelsaber-logo-web.svg`} />
  <meta name="theme-color" content="#972DE2" />
</svelte:head>
<!-- #endregion Page title & favicon -->

<div>
  <!-- #region top bar -->
  {#if isNavigating}
    <div class="fixed top-0 left-0 w-full h-1 bg-gradient-to-r from-[#8e28e2] via-[#DC2DE2] to-[#8e28e2] z-50 motion-safe:animate-pulse"></div>
  {/if}
  <div class="flex w-auto flex-row text-base justify-between">
    <!-- Logo -->
    <a href="/" class="flex items-center justify-start h-16 md:ml-16 ml-4 md:p-4 gap-0.5">
      <img src="/modelsaber-logo-web.svg" alt="ModelSaber Logo" class="h-8 w-8 mr-2" />
      <div class="flex flex-col items-center justify-center">
        <span class="text-xl font-bold">{m[`name`]()}</span>
        {#if env.PUBLIC_BASE_URL.includes(`localhost`)}
          <Badge variant="outline" class="bg-linear-to-tl from-[#8e28e260] to-[#DC2DE260]">Development Instance</Badge>
        {:else if env.PUBLIC_BASE_URL.includes(`saera.gay`)}
          <Badge variant="outline" class="bg-linear-to-tl from-[#DC2DE260] to-[#8e28e260]">Public Development Instance</Badge>
        {/if}
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
          <Popover.Trigger class={buttonVariants({ variant: "ghost" })}>
            <Menu />
          </Popover.Trigger>
          <Popover.Content class="flex flex-col items-center justify-center w-auto">
            {@render navbar_main("vertical")}
          </Popover.Content>
        </Popover.Root>
      {/if}
      <!-- User Avatar or Login Button -->
      <DropdownMenu.Root>
        <DropdownMenu.Trigger class="flex not-md:flex-wrap flex-row items-center gap-1 p-2 rounded-full hover:bg-accent transition-colors duration-300">
          {#if isLoggedIn}
            {#if user && user.id == 9}
              <Badge variant="outline" class="border-orange-600 text-orange-200">Test User</Badge>
            {/if}
            <Avatar.Root>
              {#if hasUnreadAlerts}
                <Avatar.Badge class="bg-red-400 top-0" />
              {/if}
              <Avatar.Image src={user?.avatarUrl} alt={user?.displayName} />
              <Avatar.Fallback>{user?.displayName}</Avatar.Fallback>
            </Avatar.Root>
          {:else}
            <SettingsIcon />
          {/if}
        </DropdownMenu.Trigger>
        <DropdownMenu.Content class="mr-10 flex flex-col">
          {#if isLoggedIn}
            <a href="/users/me">
              <DropdownMenu.Item>
                <UserIcon />
                {m[`layout.userMenu.profile`]()}
              </DropdownMenu.Item>
            </a>
            <button onclick={openAlertsSidebar}>
              <DropdownMenu.Item>
                <BellIcon />
                {m[`layout.userMenu.alerts`]()}
                {#if hasUnreadAlerts}
                  <Badge class="ml-0.5" variant="destructive">
                    {unreadAlertCount}
                  </Badge>
                {/if}
              </DropdownMenu.Item>
            </button>
            <a href="/requests">
              <DropdownMenu.Item>
                <MessageCircleQuestionIcon />
                {m[`layout.userMenu.requests`]()}
              </DropdownMenu.Item>
            </a>
            {#if checkRoles(user, { hasOneOf: [UserPermissions.Advanced_Admin_Tasks, UserPermissions.Administrative_Tasks, UserPermissions.Mods_Approval, UserPermissions.Game_Create, UserPermissions.Game_Edit, UserPermissions.Game_EditVersions, UserPermissions.Game_ViewExtras, UserPermissions.Users_EditAllRoles] },  //UserPermissions.Users_Ban, //not needed atm
              `any`)}
              <a href="/admin">
                <DropdownMenu.Item>
                  <Settings />
                  {m[`layout.userMenu.adminPanel`]()}
                </DropdownMenu.Item>
              </a>
            {/if}
            {#if checkRoles(user, [UserPermissions.Advanced_Admin_Tasks])}
              <button onclick={() => handleLoggerConnection(!isLoggerConnected)}>
                <DropdownMenu.Item>
                  <Server />
                  {isLoggerConnected ? `Disconnect Logger` : `Connect Logger`}
                </DropdownMenu.Item>
              </button>
            {/if}
            {#if checkRoles(user, [UserPermissions.Secret_Features])}
              <button onclick={removeSecret}>
                <DropdownMenu.Item>
                  <TrafficConeIcon class="text-orange-500" />
                  {m[`layout.userMenu.disableSecretFeatures`]()}
                </DropdownMenu.Item>
              </button>
            {/if}
            {#if checkRoles(user, [UserPermissions.Asset_Create, UserPermissions.Mods_Create], `any`)}
              <DropdownMenu.Sub>
                <DropdownMenu.SubTrigger>
                  <PlusIcon />
                  {m[`layout.userMenu.create`]()}
                </DropdownMenu.SubTrigger>
                <DropdownMenu.SubContent class="">
                  {#if checkRoles(user, [UserPermissions.Mods_Create], `any`)}
                    <a href="/create/project">
                      <DropdownMenu.Item>
                        <FolderGit2Icon />
                        {m[`layout.userMenu.createProject`]()}
                      </DropdownMenu.Item>
                    </a>
                  {/if}
                  {#if checkRoles(user, [UserPermissions.Mods_Create], `any`)}
                    <a href="/create/asset">
                      <DropdownMenu.Item>
                        <FileAxis3DIcon />
                        {m[`layout.userMenu.createAsset`]()}
                      </DropdownMenu.Item>
                    </a>
                  {/if}
                </DropdownMenu.SubContent>
              </DropdownMenu.Sub>
            {/if}
            <DropdownMenu.Separator />
          {/if}
          <p class="p-1 text-sm">{m[`layout.userMenu.options`]()}</p>
          <DropdownMenu.Sub>
            <DropdownMenu.SubTrigger>
              <LanguagesIcon />
              {m[`layout.userMenu.language`]()}
            </DropdownMenu.SubTrigger>
            <DropdownMenu.SubContent class="">
              <DropdownMenu.RadioGroup
                value={getLocale()}
                onValueChange={(val) => {
                  // @ts-expect-error: setLocale is a function that takes a string, but the type system doesn't know that
                  setLocale(val).then(() => {
                    invalidateAll();
                  });
                }}>
                <DropdownMenu.Label>{m[`layout.userMenu.language`]()}</DropdownMenu.Label>
                {#each availableLocales as locale}
                  {#if locale.frontend}
                    {#if !locale.secret || (locale.secret && checkRoles(user, [UserPermissions.Secret_Features]))}
                      <DropdownMenu.RadioItem closeOnSelect={true} value={locale.code}>{locale.name}</DropdownMenu.RadioItem>
                    {/if}
                  {/if}
                {/each}
              </DropdownMenu.RadioGroup>
            </DropdownMenu.SubContent>
          </DropdownMenu.Sub>
          {#if isLoggedIn}
            <button
              onclick={() => {
                trpc.internal.auth.logout.mutate().then(() => {
                  invalidateAll();
                });
              }}>
              <DropdownMenu.Item>
                <LogOutIcon class="text-red-400" />
                {m[`layout.userMenu.logout`]()}
              </DropdownMenu.Item>
            </button>
          {:else}
            <button
              onclick={async () => {
                let url = await trpc.internal.auth.discordAuthInit.query({
                  redirect: `${env.PUBLIC_BASE_URL}${page.url.pathname}`,
                });
                window.location.href = url.url;
              }}>
              <DropdownMenu.Item>
                <LogInIcon />
                {m[`layout.userMenu.loginDiscord`]()}
              </DropdownMenu.Item>
            </button>
            <button
              onclick={async () => {
                let url = await trpc.internal.auth.githubAuthInit.query({
                  redirect: `${env.PUBLIC_BASE_URL}${page.url.pathname}`,
                });
                window.location.href = url.url;
              }}>
              <DropdownMenu.Item>
                <LogInIcon />
                {m[`layout.userMenu.loginGitHub`]()}
              </DropdownMenu.Item>
            </button>
          {/if}
          <DropdownMenu.Separator />
          <p class="text-xs text-muted-foreground text-center p-1"><a href="https://github.com/Saeraphinx/BadModelSaber" target="_blank">{m[`layout.userMenu.modelsaberOpenSource`]()}</a></p>
          {#if isLoggedIn}
            <a class="text-xs text-muted-foreground text-center p-1" href="{env.PUBLIC_API_URL}/docs"> API Docs </a>
          {/if}
          {#if user && checkRoles(user, [UserPermissions.Administrative_Tasks, UserPermissions.Secret_Features])}
            <DropdownMenu.Separator />
            <span class="text-xs text-muted-foreground text-center p-1">
              Administrative Information<br />
              Logged in as {user.displayName}<br />
              {user.id}
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
      <Sheet.Title class="text-lg font-semibold">{m[`layout.userMenu.alerts`]()}</Sheet.Title>
      <div class="flex flex-row justify-between items-center">
        <Sheet.Description class="text-sm flex flex-row text-gray-500">
          {#if !isLoadingAlerts}
            {#if showRead}
              {m[`layout.readAlerts`]({ count: allAlerts.length })}
            {:else}
              {m[`layout.unreadAlerts`]({ count: unreadAlertCount })}
            {/if}
          {:else}
            <div class="flex flex-row items-center justify-center gap-2">
              <Spinner class="text-gray-500" />
              <p class="text-gray-500">Loading...</p>
            </div>
          {/if}
        </Sheet.Description>
        <div class="flex items-center space-x-2">
          <Switch id="show-read" bind:checked={showRead} onCheckedChange={updateAlerts} />
          <Label for="show-read">{m[`layout.alertSidebar.showRead`]()}</Label>
        </div>
      </div>
    </Sheet.Header>
    <ScrollArea class="mx-4 min-h-0 transition-all duration-500">
      {#if showRead}
        {#each allAlerts as alert}
          <Alert
            {alert}
            class="mb-2"
            deleteFromArray={() => {
              allAlerts = allAlerts.filter((a) => a.id !== alert.id && a.createdAt !== alert.createdAt);
            }} />
        {:else}
          <div class="flex justify-center items-center gap-2">
            <p class="text-gray-500">{m[`layout.alertSidebar.noAlertsAvailable`]()}</p>
          </div>
        {/each}
      {:else}
        {#each allAlerts.filter((a) => !a.read) as alert}
          <Alert
            {alert}
            class="mb-2"
            deleteFromArray={() => {
              allAlerts = allAlerts.filter((a) => a.id !== alert.id && a.createdAt !== alert.createdAt);
            }} />
        {:else}
          <div class="flex justify-center items-center gap-2">
            <p class="text-gray-500">{m[`layout.alertSidebar.noUnreadAlerts`]()}</p>
          </div>
        {/each}
      {/if}
    </ScrollArea>
    <Sheet.Footer>
      <Sheet.Close class={buttonVariants({ variant: "outline" })}>{m[`dialogs.close`]()}</Sheet.Close>
    </Sheet.Footer>
  </Sheet.Content>
</Sheet.Root>
<!-- #endregion -->

<Toaster
  richColors={true}
  theme="dark"
  closeButton={true}
  duration={5000}
  position="top-right"
  toastOptions={{
    closeButton: true,
    duration: 5000,
    classes: {
      toast: "",
      title: "font-bold",
    },
  }} />
