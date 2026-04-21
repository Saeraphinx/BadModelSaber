import { browser } from "$app/environment";
import { flushSync, mount, type Component } from "svelte";
import { render } from "svelte/server";

export function renderToHtml<PropsType extends Record<string, any>>(
  Component: Component<PropsType>,
  props: PropsType
): string {
  if (browser) {
    // Create a temporary DOM container
    const container = document.createElement('div');
  
    // Use `mount` to render the component into the temporary container
    mount(Component, {
      target: container,
      props,
    });
  
    // Force all pending updates to sync (ensures the component has fully rendered)
    flushSync();
  
    // Extract the rendered outer HTML
    const html = container.innerHTML;
  
    return html;
  } else {
    return render(Component, { props }).body;
  }
}