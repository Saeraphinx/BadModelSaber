// See https://svelte.dev/docs/kit/types#app.d.ts
// for information about these interfaces
import type { AlertPublicAPIv3, AssetRequestPublicAPIv3, UserPublicAPI } from '$lib/scripts/from_backend/DBExtras';
import 'unplugin-icons/types/svelte'
import type { AppRouter } from '../../../../../backend/src/api/routers';
import type { createTRPC } from '$lib/scripts/utils/api';

declare global {
  namespace App {
    interface Error {
      title?: string;
      subtitle?: string;
      additionalInfo?: any;
      redirectToHome?: boolean;
      parsedErrorObj?: any;
    }
    // interface Locals {}
    interface PageData {
      user: UserPublicAPI | undefined;
      trpc: ReturnType<typeof createTRPC>;
      alertCount: number;
      requestCounts: {
        incoming: number;
        outgoing: number;
      };
      pendingToasts?: {
        type: 'info' | 'success' | 'error';
        title: string;
        description?: string;
      }[];
      pageMetadata?: {
        title?: string;
        description?: string;
        imageUrl?: string;
      };
      pageData?: any; // This can be used to pass any additional data to the page
    }
    // interface PageState {}
    // interface Platform {}
  }
}

export {};
