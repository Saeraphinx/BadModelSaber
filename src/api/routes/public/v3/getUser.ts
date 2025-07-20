import { Router } from "express";
import { auth, validate } from "../../../RequestUtils.ts";
import { Validator } from "../../../../shared/Validator.ts";
import { Asset, AssetInfer, User } from "../../../../shared/Database.ts";
import { Op, WhereOptions } from "sequelize";
import { parseErrorMessage } from "../../../../shared/Tools.ts";
import { AssetPublicAPIv3 } from "../../../../shared/database/DBExtras.ts";

export class GetUserRoutesV3 {
    public static loadRoutes(router: Router): void {
        router.get(`/user`, auth(`loggedIn`, true), (req, res) => {
            if (!req.auth.isAuthed) {
                res.status(401).json({ error: "Unauthorized" });
                return;
            }

            res.status(200).json(req.auth.user.getApiResponse());
        });

        router.get(`/users/:id`, (req, res) => {
            const { responded, data: params } = validate(req, res, `params`, Validator.z.object({
                id: Validator.zStringID
            }));
            if (responded) {
                return;
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
            const { responded, data: params } = validate(req, res, `params`, Validator.z.object({
                id: Validator.zStringID
            }));
            if (responded) {
                return;
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
                            // Query credits array to find assets where the user is credited
                            {
                                credits: {
                                    [Op.contains]: [{ userId: user.id, workDone: {[Op.not]: null} }] as any
                                },
                            }
                        ]
                    },
                    order: [["createdAt", "DESC"]]
                }).then(async assets => {
                    const response = await Promise.all(assets.map(asset => asset.getApiV3Response()));
                    res.status(200).json({ user: user.getApiResponse(), assets: response });
                }).catch(err => {
                    res.status(500).json({ message: `Error fetching assets: ${parseErrorMessage(err)}` });
                });
            }).catch(err => {
                res.status(500).json({ message: `Error fetching user: ${parseErrorMessage(err)}` });
            });
        });
    }
}