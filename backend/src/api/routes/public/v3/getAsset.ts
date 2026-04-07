import { Router } from "express";
import { Validator } from "../../../../shared/Validator.ts";
import { Asset, AssetInfer, User } from "../../../../shared/Database.ts";
import { Op, Sequelize, WhereOptions } from "sequelize";
import { parseErrorMessage } from "../../../../shared/Tools.ts";
import { assetFileFormatSchema, AssetApiV3, assetApiV3Schema, Status, statusSchema, Tags } from "../../../../shared/database/DBExtras.ts";
import { anyProcedure, router } from "../../../trpc.ts";
import { TRPCError } from "@trpc/server";
import z, { any } from "zod/v4";

export const assetsRouterV3 = router({
    getAssets: anyProcedure()
        .meta({
            openapi: {
                method: 'GET',
                path: '/v3/assets',
                tags: ['Assets'],
            }
        })
        .input(z.object({
                type: assetFileFormatSchema.optional(),
                status: statusSchema.optional(),
                tags: z.array(z.enum(Tags)).optional(),
                page: z.coerce.number().int().min(1).optional(),
                limit: z.coerce.number().int().min(1).max(250).optional(),
            }).refine((data) => {
                if (data.page || data.limit) {
                    if (!data.page || !data.limit) {
                        return false; // If one is provided, both must be provided
                    }
                }
                return true; // Valid if both are provided or neither is provided
            }, `Both page and limit must be provided together.`))
        .output(z.object({
            assets: z.array(assetApiV3Schema),
            total: z.number(),
            page: z.number().nullable()
        }))
        .query(async ({ input, ctx }) => {
            let allowedStatuses = ctx.user ? ctx.user.getAllowedStatuses(`asset`) : User.getAllowedStatuses();
            if (input.status && !allowedStatuses.includes(input.status)) {
                return { assets: [], total: 0, page: null };
            }
            let whereOptions: WhereOptions<AssetInfer> = {};
            whereOptions.status = input.status ? input.status : allowedStatuses;
            if (input.type) {
                whereOptions.type = input.type;
            }
            if (input.tags) {
                whereOptions.tags = { [Op.contains]: input.tags };
            }
            const assetCount = Asset.count({ where: whereOptions });
            const assets = await Asset.findAll({
                where: whereOptions,
                limit: input.limit ?? undefined,
                offset: input.page && input.limit ? ((input.page - 1) * input.limit) : undefined,
                order: [[`createdAt`, `DESC`]],
                include: { all: true }
            });
            let response = await Promise.all(assets.map(asset => asset.toApiV3()));
            return { assets: response, total: await assetCount, page: input.page ?? null };
        }),
    getAssetById: anyProcedure()
        .meta({
            openapi: {
                method: 'GET',
                path: '/v3/assets/{id}',
                tags: ['Assets'],
            }
        })
        .input(z.object({
            id: z.int().positive(),
        }))
        .output(assetApiV3Schema)
        .query(async ({ input, ctx }) => {
            let asset = await Asset.findByPk(input.id, { include: { all: true } });
            if (!asset) {
                asset = await Asset.findOne({
                    where: { oldId: input.id },
                    include: { all: true }
                });
                if (!asset) {
                    throw new TRPCError({code: `NOT_FOUND`, message: `Asset not found.`} );
                }
            }

            if (!asset.canView(ctx.user)) {
                throw new TRPCError({code: `FORBIDDEN`, message: `You are not allowed to view this asset.`} );
            }
            return await asset.toApiV3();
        }),
    getMultipleAssetsById: anyProcedure()
        .meta({
            openapi: {
                method: 'GET',
                path: '/v3/multi/assets',
                tags: ['Assets'],
            }
        })
        .input(z.object({
            id: z.array(z.int().positive()).min(1),
        }))
        // Record keys as numbers doesn't exist in javascript, and zod errors on it because of that
        .output(z.record(z.string(), assetApiV3Schema))
        .query(async ({ input, ctx }) => {
            const assets = await Asset.findAll({
                where: {
                    id: input.id,
                    status: User.getAllowedStatuses(ctx.user)
                },
                include: { all: true }
            });
            let response: { [key: string]: AssetApiV3 } = {};
            for (let asset of assets) {
                response[asset.id.toString()] = await asset.toApiV3();
            }
            //console.log(response);
            return response;
        }),
    getFrontPageAssets: anyProcedure()
        .output(z.array(assetApiV3Schema))
        .query(async ({ ctx }) => {
            try {
                const assets = await Asset.findAll({
                    where: {
                        status: Status.Verified,
                    },
                    limit: 20,
                    order: [
                        [Sequelize.fn('array_position', Sequelize.col('tags'), Tags.Featured), 'ASC'],
                        [Sequelize.fn('array_position', Sequelize.col('tags'), Tags.Contest), 'ASC'],
                        ['createdAt', 'DESC']
                    ],
                    include: { all: true }
                });
                let response = await Promise.all(assets.map(asset => asset.toApiV3()));
                return response;
            } catch (err) {
                console.error(err);
                throw new TRPCError({ code: `INTERNAL_SERVER_ERROR`, message: `Error fetching front page assets: ${parseErrorMessage(err)}` });
            }
        })

});

/*
export class GetAssetRoutesV3 {
    public static loadRoutes(router: Router): void {
        router.get(`/assets`, auth(`any`, true), (req, res) => {
            const { responded, data: query } = validate(req, res, `query`, Validator.zFilterAssetv3);
            if (responded) {
                return;
            }

            let allowedStatuses = Asset.allowedToViewRoles(req.auth.user);
            if (query.status && !allowedStatuses.includes(query.status)) {
                res.status(202).json([]);
                return;
            }

            let whereOptions: WhereOptions<AssetInfer> = {};
            whereOptions.status = query.status ? query.status : allowedStatuses;
            if (query.type) {
                whereOptions.type = query.type;
            }
            if (query.tags) {
                whereOptions.tags = { [Op.contains]: query.tags };
            }

            Asset.findAll({
                where: whereOptions,
                limit: query.limit ?? undefined,
                offset: query.page && query.limit ? ((query.page - 1) * query.limit) : undefined,
                order: [[`createdAt`, `DESC`]],
                attributes: query.minimalData ? [`id`, `name`, `type`, `status`, `uploaderId`, `createdAt`, `updatedAt`, `iconNames`, `tags`] : undefined,
                include: {all: true}
            }).then(async assets => {
                let response = await Promise.all(assets.map(asset => asset.getApiV3Response()));
                res.status(200).json({ assets: response, total: assets.length, page: query.page ?? null});
            }).catch(err => {
                res.status(500).json({ message: `Error fetching assets: ${parseErrorMessage(err)}` });
            });
        });

        router.get(`/assets/:id`, auth(`any`, true), (req, res) => {
            const { responded, data: params } = validate(req, res, `params`, Validator.z.object({
                id: Validator.zNumberID
            }));
            if (responded) {
                return;
            }

            Asset.findByPk(params.id, {include: {all:true}}).then(async asset => {
                if (!asset) {
                    Asset.findOne({
                        where: { oldId: params.id },
                        include: { all: true }
                    }).then(async oldAsset => {
                        if (!oldAsset) {
                            res.status(404).json({ error: `Asset not found` });
                            return;
                        }

                        if (!oldAsset.canView(req.auth.user)) {
                            res.status(403).json({ error: `You are not allowed to view this asset` });
                            return;
                        }
                        res.status(200).json(await oldAsset.getApiV3Response());
                    }).catch(err => {
                        res.status(500).json({ error: `Error fetching asset: ${parseErrorMessage(err)}` });
                    });
                    return;
                }

                if (!asset.canView(req.auth.user)) {
                    res.status(403).json({ error: `You are not allowed to view this asset` });
                    return;
                }
                
                res.status(200).json(await asset.getApiV3Response());
            }).catch(err => {
                res.status(500).json({ error: `Error fetching asset: ${parseErrorMessage(err)}` });
            });
        });

        router.get(`/multi/assets`, auth(`any`, true), (req, res) => {
            const { responded, data: ids } = validate(req, res, `query`, Validator.z.object({
                id: Validator.zAssetIdArray
            }));
            if (responded) {
                return;
            }

            Asset.findAll({
                where: {
                    id: ids,
                    status: Asset.allowedToViewRoles(req.auth.user)
                },
                include: { all: true }
            }).then(async assets => {
                let response: {[key:number]: AssetPublicAPIv3} = {};
                for (let asset of assets) {
                    response[asset.id] = await asset.getApiV3Response();
                }
                res.status(200).json(response);
                return;
            }).catch(err => {
                res.status(500).json({ error: `Error fetching assets: ${parseErrorMessage(err)}` });
            });
        });
    }
}
*/