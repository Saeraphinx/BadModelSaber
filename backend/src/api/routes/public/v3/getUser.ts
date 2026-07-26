import { Router } from "express";
import { Validator } from "../../../../shared/Validator.ts";
import { Asset, AssetInfer, Project, User } from "../../../../shared/Database.ts";
import { Op, WhereOptions } from "sequelize";
import { parseErrorMessage } from "../../../../shared/Tools.ts";
import { AssetApiV3, userApiV3Schema } from "../../../../shared/database/DBExtras.ts";
import { anyProcedure, loggedInProcedure, router } from "../../../trpc.ts";
import z from "zod/v4";
import { TRPCError } from "@trpc/server";

export const userRouterV3 = router({
    getMe: loggedInProcedure()
        .meta({
            openapi: {
                method: 'GET',
                path: '/v3/users/me',
                tags: ['Users'],
                summary: 'Get the currently authenticated user',
            }
        })
        .input(z.void())
        .output(z.intersection(
            userApiV3Schema,
            z.object({
                githubId: z.string().nullable(),
                discordId: z.string().nullable(),
                hideGithubId: z.boolean(),
                hideDiscordId: z.boolean(),
            })
        ))
        .query(({ctx}) => {
        return {
            ...ctx.user.toApiV3(),
            githubId: ctx.user.githubId,
            discordId: ctx.user.discordId,
            hideGithubId: ctx.user.hideGithubId,
            hideDiscordId: ctx.user.hideDiscordId,
        };
    }),
    getUserById: anyProcedure().input(z.object({
        id: z.int().positive()
    })).query(async ({input, ctx}) => {
        const user = await User.findByPk(input.id);
        if (!user) {
            throw new TRPCError({ code: 'NOT_FOUND', message: `User not found` });
        }
        return user.toApiV3();
    }),
    getAssetsByUserId: anyProcedure().input(z.object({
        id: z.int().positive(),
        limit: z.number().positive().optional(),
        page: z.number().positive().optional(),
    })).query(async ({input, ctx}) => {
        const user = await User.findByPk(input.id);
        if (!user) {
            throw new TRPCError({ code: 'NOT_FOUND', message: `User not found` });
        }
        let whereOptions: WhereOptions<AssetInfer> = {
            status: User.getAllowedStatuses(ctx.user),
            [Op.or]: [
                { uploaderId: user.id },
                {
                    collaboratorIds: {
                        [Op.contains]: [user.id]
                    },
                }
            ]
        };
        const assets = await Asset.findAll({
            where: whereOptions,
            limit: input.limit ?? undefined,
            offset: input.page && input.limit ? ((input.page - 1) * input.limit) : undefined,
            order: [["createdAt", "DESC"]],
            include: { all: true }
        });
        let response = await Promise.all(assets.map(asset => asset.toApiV3()));
        return { assets: response, total: assets.length, page: input.page ?? null};
    }),
    getModsByUserId: anyProcedure().input(z.object({
        id: z.int().positive(),
    })).query(async ({input, ctx}) => {
        const user = await User.findByPk(input.id);
        if (!user) {
            throw new TRPCError({ code: 'NOT_FOUND', message: `User not found` });
        }

        let projects = await Project.findAll({
            include: [{
                model: User,
                where: { id: user.id }
            }]
        });
        
        return await Promise.all(projects.filter(async p => await p.canView(ctx.user)).map(p => p.toApiV3()));
    })
});