import { inferProcedureOutput } from "@trpc/server";
import { AppRouter } from "../api/routers.ts";
import { TTLCache } from "@isaacs/ttlcache";
import { AssetApiV3, AssetPublicAPIv2, ModApiV1, ModApiv2, ModVersionsApiv2, ProjectApiV3, VersionApiV3 } from "./Database.ts";

const max = 30;
const ttl = 1000 * 60 * 5;

export class QueryCache {
    public static assetV3Cache: TTLCache<string, {
        assets: AssetApiV3[],
        total: number,
        page: number | null
    }> = new TTLCache({ max, ttl });
    public static assetV2Cache: TTLCache<string, Record<number, AssetPublicAPIv2>> = new TTLCache({ max, ttl });

    public static modV3Cache: TTLCache<string, {
        project: ProjectApiV3,
        version: VersionApiV3
    }[]> = new TTLCache({ max, ttl });
    public static modV2Cache: TTLCache<string, { mods: {
        mod: ModApiv2,
        latest: ModVersionsApiv2
    }[]}> = new TTLCache({ max, ttl });
    public static modV1Cache: TTLCache<string, ModApiV1[]> = new TTLCache({ max, ttl });

    public static clearCache(cacheName: `asset` | `mod`) {
        if (cacheName === `asset`) {
            QueryCache.assetV3Cache.clear();
            QueryCache.assetV2Cache.clear();
        } else if (cacheName === `mod`) {
            QueryCache.modV3Cache.clear();
            QueryCache.modV2Cache.clear();
            QueryCache.modV1Cache.clear();
        }
    }
}