import { env } from "$env/dynamic/public";

export function getApiUrl(path: string): string {
  return `${env.PUBLIC_API_URL}${path}`;
}

export function getAssetUrl(fileName: string): string {
  return `${env.PUBLIC_ASSET_URL}/uploads/${fileName}`;
}

export function getAssetThumbnailUrl(fileName: string): string {
  return `${env.PUBLIC_ASSET_URL}/icons/${fileName}`;
}

import { createTRPCClient, httpBatchLink } from '@trpc/client';
import type { AppRouter } from '../../../../../backend/src/api/trpc';

export const trpc = createTRPCClient<AppRouter>({
  links: [
    httpBatchLink({
      url: `${env.PUBLIC_API_URL}/trpc`,
      // You can pass any HTTP headers you wish here
      /*async headers() {
        return {
          authorization: getAuthCookie(),
        };
      },*/
    }),
  ],
});