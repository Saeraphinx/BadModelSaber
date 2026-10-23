<script lang="ts">
  import { m } from "$lib/paraglide/messages";
  import { page } from "$app/state";
  import * as Accordion from "$shadcn/components/ui/accordion";
  import { Button } from "$shadcn/components/ui/button";
  import { Separator } from "$shadcn/components/ui/separator";
  import { CodeXmlIcon, HomeIcon } from "@lucide/svelte";
  import { onMount } from "svelte";
  import { toast } from "svelte-sonner";

  let pageUserOmitted = $derived.by(() => {
    return {
      url: page.url,
      status: page.status,
      error: page.error,
      route: page.route,
      params: page.params,
      data: {
        user: {
          id: page.data.user?.id,
          displayName: page.data.user?.displayName,
          permissions: page.data.user?.permissions,
        },
        requests: {
          incoming: page.data.requestCounts?.incoming || null,
          outgoing: page.data.requestCounts?.outgoing || null,
        }
      },
    };
  });

  let subtitle = $derived.by(() => {
    if (page.error?.subtitle) {
      return page.error.subtitle;
    } else {
      switch (page.status) {
        case 401:
          return m[`errorPage.unauthorized`]();
        case 403:
          return m[`errorPage.forbidden`]();
        case 404:
          return m[`errorPage.notFound`]();
        case 500:
          return m[`errorPage.serverError`]();
        default:
          return m[`errorPage.unexpected`]();
      }
    }
  });

  let timeTill = $state(5);
  onMount(() => {
    if (page.error?.redirectToHome) {
      let interval = setInterval(() => {
        timeTill--;
      }, 1000);
      setTimeout(() => {
        clearInterval(interval);
        window.location.href = "/";
      }, 5000);
    }
  });
</script>

<div class="flex flex-col min-h-screen-nav h-screen-nav items-center overflow-scroll justify-center">
  <p class="text-3xl font-semibold mb-4">{page.error?.title ?? m[`errorPage.title`]({ status: page.status })}</p>
  <p class="text-lg text-muted-foreground mb-4">{subtitle}</p>
  <div>
    <Button
      variant="outline"
      onclick={() => {
        navigator.clipboard.writeText(JSON.stringify(page, null, 2));
        toast.success(m[`errorPage.debugInfoCopied`](), {
          description: m[`errorPage.debugInfoCopiedDescription`](),
        });
      }}>
      <CodeXmlIcon />
      {m[`errorPage.copyDebugInfo`]()}
    </Button>
    <Button variant="default" class="ml-2" href="/" disabled={page.url.pathname === "/"}>
      <HomeIcon />
      {m[`errorPage.goToHome`]()}
      {#if timeTill !== null && page.error?.redirectToHome}
        ({timeTill})
      {/if}
    </Button>
  </div>
  <Separator class="my-4 w-full max-w-md" />
    <Accordion.Root type="single" class="w-full max-w-md" value="">
      <Accordion.Item value="item-1">
      <Accordion.Trigger>{m[`errorPage.debugInfo`]()}</Accordion.Trigger>
      <Accordion.Content>
        <pre class="bg-gray-100 dark:bg-gray-900 h-96 p-4 rounded-lg overflow-x-auto text-xs"><code>{JSON.stringify(pageUserOmitted, null, 2).trim()}</code></pre>
      </Accordion.Content>
      </Accordion.Item>
    </Accordion.Root>
</div>
