import { AssetFileFormat } from '$lib/scripts/api/DBTypes';
import type { PageLoad } from './$types';

export const load = (async (data) => {
  let fileFormat = data.url.searchParams.get('type') || 'all';
  if ((Object.values(AssetFileFormat) as string[]).includes(fileFormat)) {
    fileFormat = fileFormat as AssetFileFormat;
  } else {
    fileFormat = 'all';
  }

  let typeCapital = fileFormat.split(`_`)[0].split(' ').map(str => {
    if (str.length === 0) {
      return ''; // Handle empty strings
    }
    return str.charAt(0).toUpperCase() + str.slice(1);
  }).join(' ');

  return {
    pageData: {
      fileFormat: fileFormat
    },
    pageMetadata: {
      title: `${typeCapital === `all` ? `Assets` : typeCapital} - ModelSaber`,
    },
  };
}) satisfies PageLoad;