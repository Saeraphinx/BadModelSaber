import { validate } from "../../../RequestUtils.ts";
import { LegacyValidator } from "../../../../shared/LegacyValidator.ts";
import { Router } from "express";
import { Asset, AssetFileFormat, AssetInfer, Status } from "../../../../shared/Database.ts";
import { z } from "zod/v4";
import { Op, WhereOptions } from "sequelize";

export class GetV2 {
    public static loadRoutes(router: Router): void {

        router.get(`get.php`, (req, res) => {
            const { responded, data: query } = validate(req, res, `query`, LegacyValidator.zFilterAssetv2);
            if (responded) {
                return;
            }

            let convertedType = convertAssetType(query.type);
            let filterMap = parseFilter(query.filter);
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
            if (query.sort === `date`) {
                sortingData = { type: `createdAt`, direction: query.sortDirection };
            } else if (query.sort === `name`) {
                sortingData = { type: `name`, direction: query.sortDirection };
            } else {
                sortingData = { type: `uploaderId`, direction: query.sortDirection };
            }

            Asset.findAll({
                where: {
                    id: { [Op.gte]: query.start, [Op.lte]: query.end ?? Number.MAX_SAFE_INTEGER },
                    type: convertedType,
                    status: Status.Approved,
                    ...filterOptions,
                },
                order: [[sortingData.type, sortingData.direction]],
            }).then(assets => {
                let response = assets.map(asset => asset.getApiV3Response());
            });
        })
    }
}

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
            return  [AssetFileFormat.Saber_Saber, AssetFileFormat.Platform_Plat, AssetFileFormat.Avatar_Avatar, AssetFileFormat.Note_Bloq];
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