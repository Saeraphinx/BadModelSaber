import type { AssetApiV3, ElementType, ProjectApiV3, VersionApiV3 } from "../api/DBTypes";
import { Index } from "flexsearch";

export function generateAssetSearchEngine(assets: AssetApiV3[]) {
  const searchEngine = new Index({
    tokenize: "reverse"
  })

  let returnMap = new Map<number, AssetApiV3>();

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

export function generateProjectSearchEngine(mods: {project: ProjectApiV3, version: VersionApiV3}[]) {
  const searchEngine = new Index({
    tokenize: "reverse"
  })

  let returnMap = new Map<number, ElementType<typeof mods>>();

  mods.forEach((mod) => {
    returnMap.set(mod.project.id, mod);
    searchEngine.add(mod.project.id, `${mod.project.name} ${mod.project.description} ${mod.project.authors.map((a) => `${a.displayName} ${a.username}`).join(` `)} }`);
  });

  return {
    mods: returnMap,
    searchEngine: searchEngine,
    search: (query: string) => {
      return searchEngine.search(query).map((result) => {
        return returnMap.get(parseInt(result.toString()));
      }).filter((asset) => asset !== undefined);
    }
  }
}