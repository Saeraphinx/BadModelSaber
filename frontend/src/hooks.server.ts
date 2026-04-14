import type { Handle, HandleFetch } from '@sveltejs/kit';
import { paraglideMiddleware } from '$lib/paraglide/server';
import { env } from '$env/dynamic/public';
import { browser } from '$app/environment';

// creating a handle to use the paraglide middleware
const paraglideHandle: Handle = ({ event, resolve }) =>
  paraglideMiddleware(event.request, ({ request: localizedRequest, locale }) => {
    event.request = localizedRequest;
    return resolve(event, {
      transformPageChunk: ({ html }) => {
        return html.replace('%lang%', locale);
      }
    });
  });

export const handle: Handle = paraglideHandle;

export const handleFetch: HandleFetch = async ({ request, fetch: svelteFetch, event }) => {
  let modifiedRequest = request;
  let fetchToUse = svelteFetch;
  if (!browser && request.url.startsWith(env.PUBLIC_API_URL)) {
    // https://github.com/sveltejs/kit/issues/8314
    console.log(`Modifying request to ${request.url}`);
    modifiedRequest = new Request(request, {
      headers: {
        ...request.headers,
        origin: event.url.origin,
      },
    });
    fetchToUse = fetch;
  }
	return fetchToUse(modifiedRequest).then((response) => {
    console.log(`Fetch request to ${request.url} returned with status ${response.status}`);
    console.log(modifiedRequest);
    console.log(response);
    return response;
  }).catch((err) => {
    console.error(`Fetch request to ${request.url} failed with error:`, err);
    throw err;
  });
};
