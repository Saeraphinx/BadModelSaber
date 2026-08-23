import type { Handle, HandleFetch, ServerInit } from '@sveltejs/kit';
import { env } from '$env/dynamic/public';
import { env as penv } from '$env/dynamic/private';
import { browser, dev } from '$app/environment';

// // creating a handle to use the paraglide middleware
// const paraglideHandle: Handle = ({ event, resolve }) =>
//   paraglideMiddleware(event.request, ({ request: localizedRequest, locale }) => {
//     event.request = localizedRequest;
//     return resolve(event, {
//       transformPageChunk: ({ html }) => {
//         return html.replace('%lang%', locale);
//       }
//     });
//   });

// export const handle: Handle = paraglideHandle;
let hasWarnedAboutCORS = false;
export const handleFetch: HandleFetch = async ({ request, fetch: svelteFetch, event }) => {
  let modifiedRequest = request;
  let fetchToUse = svelteFetch;
  if (!browser && request.url.startsWith(env.PUBLIC_API_URL)) {
      
    // replace url with local version if the request is going to the API, no need to hit the proxy
    let url = new URL(penv.LOCAL_API_URL ? request.url.replace(env.PUBLIC_API_URL, penv.LOCAL_API_URL || env.PUBLIC_API_URL) : request.url);
    if (event.url.origin !== url.origin && dev && !hasWarnedAboutCORS) {
      console.warn(`Request to ${url.origin} is going to a different origin than the server (${event.url.origin} vs ${url.origin}). This request will require CORS.`);  
      hasWarnedAboutCORS = true;
    }
    modifiedRequest = new Request(url, {
      headers: {
        ...request.headers,
        "user-agent": `BMS-SvelteKit-Server`,
        origin: event.url.origin,
      },
    });
    //fetchToUse = fetch;
  }
	return fetchToUse(modifiedRequest).then((response) => {
    //console.log(`Fetch request to ${request.url} returned with status ${response.status}`);
    //console.log(event);
    //console.log(modifiedRequest);
    //console.log(response);
    return response;
  }).catch((err) => {
    console.error(`Fetch request to ${request.url} failed with error:`, err);
    throw err;
  });
};