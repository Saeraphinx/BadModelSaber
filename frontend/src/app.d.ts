// See https://svelte.dev/docs/kit/types#app.d.ts
// for information about these interfaces
import type { AlertPublicAPIv3, AssetRequestPublicAPIv3, UserPublicAPI } from '$lib/scripts/api/DBTypes';
import 'unplugin-icons/types/svelte'

declare global {
  namespace App {
    interface Error {
      title?: string;
      subtitle?: string;
      additionalInfo?: any;
      redirectToHome?: boolean;
    }
    // interface Locals {}
    interface PageData {
      user?: UserPublicAPI;
      requestCounts: {
        incoming: number;
        outgoing: number;
        reports: number | null; // Optional, can be null if not available
      };
      fetch : typeof fetch; // Optional fetch override for server-side requests & to make sveltekit happy
      pendingToasts?: {
        type: 'info' | 'success' | 'error';
        title: string;
        description?: string;
      }[];
      pageMetadata?: {
        title?: string;
      };
      pageData?: any; // This can be used to pass any additional data to the page
    }
    // interface PageState {}
    // interface Platform {}
  }
}

export {};
