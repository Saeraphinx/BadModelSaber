import { env } from "$env/dynamic/public";

export function getAssetUrl(assetId: number, fileName: string): string {
  return `${env.PUBLIC_ASSET_URL}/${assetId}/${fileName}`;
}

import { createTRPCClient, httpBatchLink, httpLink, isNonJsonSerializable, splitLink } from '@trpc/client';
import type { AppRouter } from '../../../../../backend/src/api/routers';
import SuperJSON from "superjson";

export const trpc = createTRPCClient<AppRouter>({
  links: [
    splitLink({
      condition: (op) => isNonJsonSerializable(op.input),
      true: httpLink({ // this section is needed for file uploads
        url: `${env.PUBLIC_API_URL}/trpc`,
        fetch: (input, init) => {
          return fetch(input, {
            ...init,
            credentials: 'include',
          });
        },
        transformer: {
          serialize: (data) => data,
          deserialize: SuperJSON.deserialize,
        },
      }),
      false: httpBatchLink({
        url: `${env.PUBLIC_API_URL}/trpc`,
        fetch: (input, init) => {
          return fetch(input, {
            ...init,
            credentials: 'include',
          });
        },
        transformer: SuperJSON,
      }),
    }),
  ],
});

export function parseError(err: unknown): {
  message: string;
  code: number;
} {
  try {
    let anyErr = err as any;
    if (anyErr) {
      if (anyErr.data?.httpStatus) {
        return {
          message: parseErrorMessage(err),
          code: anyErr.data.httpStatus as number ?? 500,
        };
      }
      else {
        return {
          message: parseErrorMessage(err),
          code: 500,
        };
      }
    } else {
      return {
        message: `Unkown error`,
        code: 500,
      };
    }
  } catch (e) {
    console.error(`Error parsing error: ${e}`);
    return {
      message: `Unknown error`,
      code: 500,
    };
  }
}
    

export function parseErrorMessage(err: unknown): string {
  try {
    let anyErr = err as any;
    if (anyErr) {
      if (anyErr.data?.formattedMessage) {
        return anyErr.data.formattedMessage as string;
      } else if (err instanceof Error) {
        return `${err.message}`;
      } else if (typeof err === `string`) {
        return err;
      } else {
        return JSON.stringify(err);
      }
    } else {
      return JSON.stringify(err);
    }
  } catch (e) {
    console.error(`Error parsing error message: ${e}`);
    return `Unknown error`;
  }
}