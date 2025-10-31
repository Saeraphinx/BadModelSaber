import type { AssetPublicAPIv3 } from "../api/DBTypes";
import { Index } from "flexsearch";

export function generateAssetSearchEngine(assets: AssetPublicAPIv3[]) {
  const searchEngine = new Index({
    tokenize: "reverse"
  })

  let returnMap = new Map<number, AssetPublicAPIv3>();

  assets.forEach((asset) => {
    returnMap.set(asset.id, asset);
    searchEngine.add(asset.id, `${asset.name} ${asset.description} ${asset.uploader} ${asset.tags.join(" ")}`);
  });

  return {
    assets: returnMap,
    searchEngine: searchEngine,
    search: (query: string) => {
      return searchEngine.search(query).map((result) => {
        return returnMap.get(parseInt(result.toString()));
      }).filter((asset) => asset !== undefined);
    }
  }
}