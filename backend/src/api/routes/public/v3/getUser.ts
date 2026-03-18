import { Router } from "express";
import { Validator } from "../../../../shared/Validator.ts";
import { Asset, AssetInfer, User } from "../../../../shared/Database.ts";
import { Op, WhereOptions } from "sequelize";
import { parseErrorMessage } from "../../../../shared/Tools.ts";
import { AssetApiV3, userApiV3Schema } from "../../../../shared/database/DBExtras.ts";
import { anyProcedure, loggedInProcedure, router } from "../../../trpc.ts";
import z from "zod/v4";

export const userRouterV3 = router({
    getMe: loggedInProcedure()
        .meta({
            openapi: {
                method: 'GET',
                path: '/v3/users/me',
                tags: ['Users'],
            }
        })
        .input(z.void())
        .output(userApiV3Schema)
        .query(({ctx}) => {
        return ctx.user.toApiV3();
    }),
    getUserById: anyProcedure().input(z.object({
        id: z.int().positive()
    })).query(async ({input, ctx}) => {
        const user = await User.findByPk(input.id);
        if (!user) {
            throw new Error(`User not found`);
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
            throw new Error(`User not found`);
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
    })
});

/*
export class GetUserRoutesV3 {
    public static loadRoutes(router: Router): void {
        router.get(`/users/:id`, auth(`any`, true), (req, res) => {
            const { responded, data: params } = validate(req, res, `params`, Validator.z.object({
                id: Validator.zUserID
            }));
            if (responded) {
                return;
            }

            if (params.id === `me` && req.auth.isAuthed) {
                params.id = req.auth.user.id;
            }

            User.findByPk(params.id).then(user => {
                if (!user) {
                    res.status(404).json({ message: `User not found` });
                    return;
                }

                res.status(200).json(user.getApiResponse());
            }).catch(err => {
                res.status(500).json({ message: `Error fetching user: ${parseErrorMessage(err)}` });
            });
        });

        router.get(`/users/:id/assets`, auth(`any`, true), (req, res) => {
            const { responded: pResponded, data: params } = validate(req, res, `params`, Validator.z.object({
                id: Validator.zUserID
            }));
            const { responded: qResponded, data: query } = validate(req, res, `query`, Validator.zFilterAssetv3.pick({
                page: true,
                limit: true
            }));
            if (pResponded || qResponded) {
                return;
            }

            if (params.id === `me` && req.auth.isAuthed) {
                params.id = req.auth.user.id;
            }

            User.findByPk(params.id).then(user => {
                if (!user) {
                    res.status(404).json({ message: `User not found` });
                    return;
                }

                Asset.findAll({
                    where: {
                        status: Asset.allowedToViewRoles(req.auth.user),
                        [Op.or]: [
                            { uploaderId: user.id },
                            {
                                collaborators: {
                                    [Op.contains]: [user.id]
                                },
                            }
                        ]
                    },
                    limit: query.limit ?? undefined,
                    offset: query.page && query.limit ? ((query.page - 1) * query.limit) : undefined,
                    order: [["createdAt", "DESC"]],
                    include: { all: true }
                }).then(async assets => {
                    const response = await Promise.all(assets.map(asset => asset.getApiV3Response()));
                    res.status(200).json({ assets: response, total: assets.length, page: query.page ?? null} );
                }).catch(err => {
                    res.status(500).json({ message: `Error fetching assets: ${parseErrorMessage(err)}` });
                });
            }).catch(err => {
                res.status(500).json({ message: `Error fetching user: ${parseErrorMessage(err)}` });
            });
        });
    }
}
    */