<script lang="ts">
  import { page } from "$app/state";
  import * as Accordion from "$shadcn/components/ui/accordion";
  import { Button } from "$shadcn/components/ui/button";
  import Separator from "$shadcn/components/ui/separator/separator.svelte";
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
          roles: page.data.user?.roles,
        },
        alerts: page.data.alerts?.map((alert: any) => alert.id) || [],
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
          return `You need to be logged in to view this page.`;
        case 403:
          return `You do not have permission to view this page.`;
        case 404:
          return `We couldn't find this page :/`;
        case 500:
          return `Something went wrong on our end.`;
        default:
          return `An unexpected error occurred. Please try again later.`;
      }
    }
  });

  onMount(() => {
    if (page.error?.redirectToHome) {
      window.location.href = "/";
      return;
    }
  });
</script>

<div class="flex flex-col min-h-screen-nav h-screen-nav items-center overflow-scroll justify-center">
  <p class="text-3xl font-semibold mb-4">{page.error?.title ?? `Error ${page.status}`}</p>
  <p class="text-lg text-muted-foreground mb-4">{subtitle}</p>
  <div>
    <Button
      variant="outline"
      onclick={() => {
        navigator.clipboard.writeText(JSON.stringify(page, null, 2));
        toast.success("Debug info copied to clipboard", {
          description: "You can paste this in a GitHub issue or Discord for help. NOTE: This includes info about the current page & user data.",
        });
      }}>
      <CodeXmlIcon />
      Copy Debug Info
    </Button>
    <Button variant="default" class="ml-2" href="/" disabled={page.url.pathname === "/"}>
      <HomeIcon />
      Go to Home
    </Button>
  </div>
  <Separator class="my-4 w-full max-w-md" />
    <Accordion.Root type="single" class="w-full max-w-md" value="">
      <Accordion.Item value="item-1">
      <Accordion.Trigger>Debug Info</Accordion.Trigger>
      <Accordion.Content>
        <pre class="bg-gray-100 dark:bg-gray-900 h-96 p-4 rounded-lg overflow-x-auto text-xs"><code>{JSON.stringify(pageUserOmitted, null, 2).trim()}</code></pre>
      </Accordion.Content>
      </Accordion.Item>
    </Accordion.Root>
</div>
