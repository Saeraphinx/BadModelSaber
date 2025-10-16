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
type SuccessResponse<T> = {
  response: Response;
  message: string;
  data: T;
  status: number;
  isError: false;
}
type CustomFetchResponse<T> = SuccessResponse<T> | {
  response: null;
  message: string;
  data: T | null;
  status: number;
  isError: true;
}

export function fetchApiSafe<T>(path: string, options?: RequestInit, customFetch = globalThis.fetch): Promise<CustomFetchResponse<T>> {
  return _fetchApi<T>(path, options, customFetch, false);
}

export function fetchApi<T>(path: string, options?: RequestInit, customFetch = globalThis.fetch): Promise<SuccessResponse<T>> {
  return _fetchApi<T>(path, options, customFetch, true) as unknown as Promise<SuccessResponse<T>>;
}

async function _fetchApi<T>(path: string, options?: RequestInit, customFetch = globalThis.fetch, errorOnNonOK = true): Promise<CustomFetchResponse<T>> {
  if (!env.PUBLIC_API_URL) {
    throw new Error("PUBLIC_API_URL is not defined in environment variables.");
  }
  const url = getApiUrl(path);
  return customFetch(url, {
    ...options,
    method: options?.method || "GET",
    credentials: "include",
    headers: {
      "Content-Type": "application/json",
      "User-Agent": `BadModelSaber-frontend/${env.PUBLIC_VERSION}`,
      ...options?.headers,
    },
  }).then(async (response) => {
    if (!response.ok) {
      return response.json().then((error: {message: string}) => {
        console.error(response);
        if (errorOnNonOK) {
          throw new Error(`Server Error: ${error.message}`);
        } else {
          return {
            response: null,
            message: error.message || response.statusText || "Error",
            data: null,
            status: response.status,
            isError: true as true,
          }
        }
      }).catch((error) => {
        throw new Error(`Parsing JSON Error: ${error.message}`);
      });
    }
    let message = response.statusText || "Success";
    let data = null;
    if (response.status !== 204) {
      data = await response.json().catch((error) => {
        throw new Error(`JSON Parsing error: ${error.message}`);
      });
      if (data && typeof data === 'object' && `message` in data) {
        message = data.message || message;
      }
    }
    return {
      response: response,
      message: message,
      data: data,
      status: response.status,
      isError: false as false,
    }
  }).catch((error) => {
    //console.error(`Error fetching ${url}:`, error)
    throw error
  });
}