import { Asset, AssetInfer, User } from "../../../../shared/Database.ts";
import { Op, WhereOptions } from "sequelize";
import { assetFileFormatSchema, AssetApiV3, assetApiV3Schema, Status, statusSchema, Tags } from "../../../../shared/database/DBExtras.ts";
import { anyProcedure, router } from "../../../trpc.ts";
import { TRPCError } from "@trpc/server";
import z from "zod/v4";

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
        })
});