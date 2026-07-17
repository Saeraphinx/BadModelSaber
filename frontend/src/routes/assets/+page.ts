import { AssetFileFormat, RenderingModes, Status } from '$lib/scripts/from_backend/DBExtras';
import type { PageLoad } from './$types';

export const load = (async (data) => {
  let fileFormat = data.url.searchParams.get('type')?.split(',') || ['all'];
  let renderingMethod = data.url.searchParams.get('renderingMethod');
  let status = data.url.searchParams.get('status');
  let searchQuery = data.url.searchParams.get('search') || '';
  if (fileFormat.every(format => (Object.values(AssetFileFormat) as string[]).includes(format))) {
    fileFormat = fileFormat as AssetFileFormat[];
  } else {
    fileFormat = ['all'];
  }

  if (renderingMethod && (Object.values(RenderingModes) as string[]).includes(renderingMethod)) {
    renderingMethod = renderingMethod as RenderingModes;
  } else {
    renderingMethod = null;
  }

  if (status && (Object.values(Status) as string[]).includes(status)) {
    status = status as Status;
  } else {
    status = null;
  }

  let typeCapital = fileFormat[0].split(`_`)[0].split(' ').map(str => {
    if (str.length === 0) {
      return ''; // Handle empty strings
    }
    return str.charAt(0).toUpperCase() + str.slice(1);
  }).join(' ');

  return {
    pageData: {
      // type checks are done above
      fileFormat: fileFormat as AssetFileFormat[] | ['all'],
      renderingMethod: renderingMethod as RenderingModes | null,
      status: status as Status | null,
      searchQuery: searchQuery as string,
    },
    pageMetadata: {
      title: `Assets`,
    },
  };
});