import { checkAssetRedirect } from '../../lib/scripts/utils/redirects';
import type { PageLoad } from './$types';

export const load: PageLoad = ({ url }) => {
  checkAssetRedirect(`Platforms`,  url.searchParams)
};