import { Router } from "express";
import { auth, validate } from "../../../RequestUtils.ts";
import { Validator } from "../../../../shared/Validator.ts";
import { Asset, AssetInfer } from "../../../../shared/Database.ts";
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
            if (query.fileFormat) {
                whereOptions.fileFormat = query.fileFormat;
            }
            if (query.tags) {
                whereOptions.tags = { [Op.contains]: query.tags };
            }

            Asset.findAll({
                where: whereOptions,
                limit: query.limit ?? undefined,
                offset: query.page && query.limit ? ((query.page - 1) * query.limit) : undefined,
                order: [[`createdAt`, `DESC`]]
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

            Asset.findByPk(params.id).then(async asset => {
                if (!asset) {
                    res.status(404).json({ error: `Asset not found` });
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
            const { responded, data: ids } = validate(req, res, `query`, Validator.zAssetIdArray.max(50));
            if (responded) {
                return;
            }

            Asset.findAll({
                where: {
                    id: ids,
                    status: Asset.allowedToViewRoles(req.auth.user)
                }
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