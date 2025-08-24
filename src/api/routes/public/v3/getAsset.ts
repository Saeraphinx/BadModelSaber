import { Router } from "express";
import { auth, validate } from "../../../RequestUtils.ts";
import { Validator } from "../../../../shared/Validator.ts";
import { Asset, AssetInfer, User } from "../../../../shared/Database.ts";
import { Op, WhereOptions } from "sequelize";
import { parseErrorMessage } from "../../../../shared/Tools.ts";
import { AssetPublicAPIv3 } from "../../../../shared/database/DBExtras.ts";

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