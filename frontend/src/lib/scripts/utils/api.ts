import { env } from "$env/dynamic/public";
import type { AssetApiV3, ProjectApiV3, VersionApiV3 } from "../api/DBTypes";

export function getThumbnailUrl(id: number | string, thumbnailName: string): string {
  return `${env.PUBLIC_FILE_URL}/${id}/${thumbnailName}`;
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

  // fix this
  return `${baseUrl}${modelType}/${asset.id}/${asset.name}.${asset.type.split("_")[1]}`;
}

export function getProjectThumbnailUrl(project: ProjectApiV3): string {
  return `${env.PUBLIC_FILE_URL}/${project.id}/${project.iconFileName}`;
}

export function getVersionDownloadUrl(version: VersionApiV3): string {
  return version.downloadUrl;
}

export function getVersionManifestUrl(version: VersionApiV3): string {
  return `${env.PUBLIC_FILE_URL}/${version.projectId}/${version.id}/${version.baseFileName}_manifest.json`;
}

export function getVersionDecompUrl(version: VersionApiV3): string {
  return `${env.PUBLIC_FILE_URL}/${version.projectId}/${version.id}/decompiled/${version.baseFileName}.decompiled.cs`;
}

import { createTRPCClient, httpBatchLink, httpLink, isNonJsonSerializable, isTRPCClientError, splitLink, TRPCClientError } from '@trpc/client';
import type { AppRouter } from '../../../../../backend/src/api/routers';
import SuperJSON from "superjson";
import { error } from "@sveltejs/kit";
import z from "zod";

export const trpc = createTRPC();

export function createTRPC(svelteFetch: typeof fetch = fetch) {
  //let svelteFetch = svelteFetcht;

  // this is to both make sure that the cookies are included in the request if required and that readablestream doesn't get locked
  const safeFetch = async (input: RequestInfo | URL, init?: RequestInit) => {
    if (!env.PUBLIC_API_URL.startsWith(env.PUBLIC_BASE_URL)) {
      init = {
        ...init,
        credentials: 'include' 
      }
    }
    const response = await svelteFetch(input, init);
    return response.clone();
  };

  return createTRPCClient<AppRouter>({
    links: [
      splitLink({
        condition: (op) => isNonJsonSerializable(op.input),
        true: httpLink({ // this section is needed for file uploads
          url: `${env.PUBLIC_API_URL}/trpc`,
          fetch: safeFetch,
          transformer: {
            serialize: (data) => data,
            deserialize: SuperJSON.deserialize,
          },
        }),
        false: httpBatchLink({
          url: `${env.PUBLIC_API_URL}/trpc`,
          fetch: safeFetch,
          transformer: SuperJSON,
        }),
      }),
    ],
  });
}

export function parseTRPCError(err: unknown): {
  err: TRPCClientError<AppRouter>;
  formattedMessage: string;
  zodError?: z.ZodError;
  message: string;
  httpCode: number;
} {
  if (isTRPCClientError<AppRouter>(err)) {
    //debugger;
    return {
      err: err,
      formattedMessage: err.data?.formattedMessage ?? err.message ?? `Unable to parse error message.`,
      zodError: err.data?.zodError,
      message: err.message,
      httpCode: err.data?.httpStatus ?? 500,
    };
  } else {
    throw err;
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

export function handleTrpcError(shouldThrow: false, shouldLog?: `full` | `minimal` | `none`): (err: unknown) => ReturnType<typeof parseTRPCError>
export function handleTrpcError(shouldThrow?: true, shouldLog?: `full` | `minimal` | `none`): (err: unknown) => never
export function handleTrpcError(shouldThrow = true, shouldLog = `minimal`): (err: unknown) => ReturnType<typeof parseTRPCError> | never {
  return (err) => {
    if (shouldLog === `full`) {
      console.error(err);
    }
    let parsedError;
    try {
      parsedError = parseTRPCError(err);
    } catch (err2) {
      throw error(500, {
        message: parseErrorMessage(err),
        title: "Unknown Error",
      });
    }

    if (shouldLog === `minimal`) {
      if (parsedError.zodError) {
        console.error(`Validation error: ${parsedError.formattedMessage}`);
        console.error(`Zod error details: ${JSON.stringify(z.prettifyError(parsedError.zodError))}`);
      } else {
        console.error(`Error: ${parsedError.formattedMessage}`);
      }
    }

    let isZodError = parsedError.zodError !== undefined;
    if (shouldThrow) {
      if (parsedError.formattedMessage === `fetch failed`) {
        parsedError.formattedMessage = `Network error: Unable to reach the server. Please check your internet connection and try again.`;
        parsedError.httpCode = 503;
      }
      throw error(parsedError.httpCode, {
        message: parsedError.formattedMessage,
        additionalInfo: parsedError.zodError ? z.prettifyError(parsedError.zodError) : undefined,
        title: isZodError ? "Validation Error" : undefined,
        subtitle: parsedError.formattedMessage,
        parsedErrorObj: JSON.stringify(parsedError),
      });
    } else {
      return parsedError;
    }
  }
}