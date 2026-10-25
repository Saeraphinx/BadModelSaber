import { redirect } from "@sveltejs/kit";

export function checkAssetRedirect(pageType: `Sabers` | `Notes` | `Platforms` | `Avatars`, searchQuery: URLSearchParams): never {
  let id = searchQuery.get('id')
  if (id) {
    throw redirect(307, `/assets/${id}`);
  } else {
    switch (pageType) {
      case `Sabers`:
        throw redirect(307, `/assets?type=saber_saber`);
      case `Notes`:
        throw redirect(307, `/assets?type=note_bloq`);
      case `Platforms`:
        throw redirect(307, `/assets?type=platform_plat`);
      case `Avatars`:
        throw redirect(307, `/assets?type=avatar_avatar`);
      default:
        throw redirect(307, `/assets`);
    }
  }
}