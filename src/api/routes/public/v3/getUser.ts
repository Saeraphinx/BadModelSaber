import { Router } from "express";
import { auth, validate } from "../../../RequestUtils.ts";
import { Validator } from "../../../../shared/Validator.ts";
import { Asset, AssetInfer, User } from "../../../../shared/Database.ts";
import { Op, WhereOptions } from "sequelize";
import { parseErrorMessage } from "../../../../shared/Tools.ts";
import { AssetPublicAPIv3 } from "../../../../shared/database/DBExtras.ts";

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
                                credits: {
                                    [Op.contains]: [{ userId: user.id, workDone: {[Op.not]: null} }] as any
                                },
                            }
                        ]
                    },
                    limit: query.limit ?? undefined,
                    offset: query.page && query.limit ? ((query.page - 1) * query.limit) : undefined,
                    order: [["createdAt", "DESC"]]
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