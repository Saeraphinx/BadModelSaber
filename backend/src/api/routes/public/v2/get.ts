import { LegacyValidator } from "../../../../shared/LegacyValidator.ts";
import { Asset, AssetFileFormat, AssetInfer, assetPublicAPIv1Schema, Status } from "../../../../shared/Database.ts";
import { z } from "zod/v4";
import { Op, WhereOptions } from "sequelize";
import { authProcedure, router } from "../../../trpc.ts";

export const GetV2Router = router({
    getAssets: authProcedure(`any`)
        .meta({
            openapi: {
                method: 'GET',
                path: '/v2/get.php',
                tags: ['Assets'],
            }
        })
        .input(LegacyValidator.zFilterAssetv2)
        .output(z.record(z.number(), assetPublicAPIv1Schema))
        .query(async ({ input, ctx }) => {
        let convertedType = convertAssetType(input.type);
        let filterMap = parseFilter(input.filter);
        let filterOptions: WhereOptions<AssetInfer> = {};
        for (let [filterType, value] of filterMap.entries()) {
            if (filterType === `author`) {
                // author will be filtered later
                continue;
            }
            let whereOptions = convertToWhereOptions(filterType, value);
            Object.assign(filterOptions, whereOptions);
        }

        let sortingData: { type: string, direction: string };
        if (input.sort === `date`) {
            sortingData = { type: `createdAt`, direction: input.sortDirection };
        } else if (input.sort === `name`) {
            sortingData = { type: `name`, direction: input.sortDirection };
        } else {
            sortingData = { type: `id`, direction: input.sortDirection };
        }

        Asset.findAll({
            where: {
                id: { [Op.gte]: input.start, [Op.lte]: input.end ?? Number.MAX_SAFE_INTEGER },
                type: convertedType,
                status: Status.Verified,
                ...filterOptions,
            },
            order: [[sortingData.type, sortingData.direction]],
        }).then(async assets => {
            let promises = assets.map(async asset => asset.getApiV1Response());
            let repsonse = {} as { [key: number]: Awaited<ReturnType<Asset[`getApiV1Response`]>> };
            await Promise.all(promises).then((values) => {
                for (let i = 0; i < values.length; i++) {
                    repsonse[assets[i].id] = values[i];
                }
                return repsonse;
            });
        });

        return {};
    })
})

function convertAssetType(type: string): AssetFileFormat[] {
    switch (type) {
        case `saber`:
            return [AssetFileFormat.Saber_Saber];
        case `platform`:
            return [AssetFileFormat.Platform_Plat];
        case `avatar`:
            return [AssetFileFormat.Avatar_Avatar];
        case `bloq`:
            return [AssetFileFormat.Note_Bloq];
        case `all`:
        default:
            return [AssetFileFormat.Saber_Saber, AssetFileFormat.Platform_Plat, AssetFileFormat.Avatar_Avatar, AssetFileFormat.Note_Bloq];
    }
}

function parseFilter(filter: z.infer<typeof LegacyValidator.zFilterAssetv2>['filter']) {
    let map = new Map<z.infer<typeof LegacyValidator.zFilterTypes>, { includeMerge: string[], excludeMerge: string[] }>();
    if (!filter || !Array.isArray(filter)) {
        return map;
    }
    for (let filterType of LegacyValidator.zFilterTypes.options) {
        let filterValues = filter.filter(f => f.type === filterType);
        let includeMerge: string[] = [];
        let excludeMerge: string[] = [];
        for (let filterValue of filterValues) {
            if (filterValue.value.startsWith(`-`)) {
                excludeMerge.push(filterValue.value.slice(1));
            } else {
                includeMerge.push(filterValue.value);
            }
        }
        if (includeMerge.length === 0 && excludeMerge.length === 0) {
            continue;
        }
        map.set(filterType, { includeMerge, excludeMerge });
    }
    return map;
}

function convertToWhereOptions(filterType: string, value: {
    includeMerge: string[];
    excludeMerge: string[];
}): WhereOptions<AssetInfer> {
    let { includeMerge, excludeMerge } = value;
    let isBoth = includeMerge.length > 0 && excludeMerge.length > 0;
    let isInclude = includeMerge.length > 0;
    let isExclude = excludeMerge.length > 0;
    switch (filterType) {
        case `discordid`:
            if (isBoth) {
                return {
                    [Op.or]: [
                        { uploaderId: { [Op.in]: includeMerge } },
                        { uploaderId: { [Op.notIn]: excludeMerge } }
                    ]
                };
            } else if (isInclude) {
                return { uploaderId: { [Op.in]: includeMerge } };
            } else if (isExclude) {
                return { uploaderId: { [Op.notIn]: excludeMerge } };
            }
            break;
        case `hash`:
            if (isBoth) {
                return {
                    [Op.or]: [
                        { fileHash: { [Op.in]: includeMerge } },
                        { fileHash: { [Op.notIn]: excludeMerge } }
                    ]
                };
            } else if (isInclude) {
                return { fileHash: { [Op.in]: includeMerge } };
            } else if (isExclude) {
                return { fileHash: { [Op.notIn]: excludeMerge } };
            }
            break;
        case "id":
            if (isBoth) {
                return {
                    [Op.or]: [
                        { id: { [Op.in]: includeMerge.map(Number) } },
                        { id: { [Op.notIn]: excludeMerge.map(Number) } }
                    ]
                };
            } else if (isInclude) {
                return { id: { [Op.in]: includeMerge.map(Number) } };
            } else if (isExclude) {
                return { id: { [Op.notIn]: excludeMerge.map(Number) } };
            }
            break;
        case `name`:
            if (isBoth) {
                return {
                    [Op.or]: [
                        { name: { [Op.like]: `%${includeMerge.join(`%`)}%` } },
                        { name: { [Op.notLike]: `%${excludeMerge.join(`%`)}%` } }
                    ]
                };
            } else if (isInclude) {
                return { name: { [Op.like]: `%${includeMerge.join(`%`)}%` } };
            } else if (isExclude) {
                return { name: { [Op.notLike]: `%${excludeMerge.join(`%`)}%` } };
            }
            break;
        case `tag`:
            if (isBoth) {
                return {
                    [Op.or]: [
                        { tags: { [Op.contains]: includeMerge as any } },
                        { tags: { [Op.not]: { [Op.contains]: excludeMerge as any } } }
                    ]
                };
            }
            else if (isInclude) {
                return { tags: { [Op.contains]: includeMerge as any } };
            } else if (isExclude) {
                return { tags: { [Op.not]: { [Op.contains]: excludeMerge as any } } };
            }
            break;
        case `author`:
            // do nothing since itll have to be filtered later
            break;

    }
    return {};
}