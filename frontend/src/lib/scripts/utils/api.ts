import { env } from "$env/dynamic/public";
import type { AssetApiV3 } from "../api/DBTypes";

export function getThumbnailUrl(id: number | string, thumbnailName:string): string {
  return `${env.PUBLIC_ASSET_URL}/${id}/${thumbnailName}`;
}

export function getAssetDownloadUrl(asset: AssetApiV3): string {
  return asset.downloadUrl;
  //return `${env.PUBLIC_ASSET_URL}/${assetId}/${fileName}`;
}

export function getOneClickUrl(asset: AssetApiV3): string {
  const baseUrl = "modelsaber://";
  let modelType: string;
  switch (asset.type) {
    case `avatar_avatar`:
      modelType = "avatar";
      break;
    case `saber_saber`:
      modelType = "saber";
      break;
    case `platform_plat`:
      modelType = "platform";
      break;
    case `note_bloq`:
      modelType = "bloq";
    default:
      modelType = asset.type
      break;
  }

  return `${baseUrl}${modelType}/${asset.id}/${asset.fileSafeName}.${asset.type.split("_")[1]}`;
}

import { createTRPCClient, httpBatchLink, httpLink, isNonJsonSerializable, isTRPCClientError, splitLink } from '@trpc/client';
import type { AppRouter } from '../../../../../backend/src/api/routers';
import SuperJSON from "superjson";
import { error } from "@sveltejs/kit";

export const trpc = createTRPC();

export function createTRPC(svelteFetch: typeof fetch = fetch) {
  //let svelteFetch = svelteFetcht;
  return createTRPCClient<AppRouter>({
    links: [
      splitLink({
        condition: (op) => isNonJsonSerializable(op.input),
        true: httpLink({ // this section is needed for file uploads
          url: `${env.PUBLIC_API_URL}/trpc`,
          fetch: (input, init) => {
            return svelteFetch(input, {
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
            //console.log(`Fetching ${input} with init:`, init);
            return svelteFetch(input, {
              ...init,
              credentials: 'include',
            });
          },
          transformer: SuperJSON,
        }),
      }),
    ],
  });
}

export function parseError(err: unknown): {
  message: string;
  code: number;
} {
  if (isTRPCClientError(err)) {
    return {
      message: err.message,
      code: err.data?.httpStatus ?? 500,
    };
  }
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

export function handleTrpcError() : (err: unknown) => never {
  return (err: unknown) => {
    console.error(err);
    let parsedError = parseError(err);
    throw error(parsedError.code, { message: parsedError.message });
  }
}