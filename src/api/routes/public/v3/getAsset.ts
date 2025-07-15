import { Router } from "express";
import { auth, validate } from "../../../RequestUtils.ts";
import { Validator } from "../../../../shared/Validator.ts";
import { Asset } from "../../../../shared/Database.ts";
import { Op } from "sequelize";
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

            Asset.findAll({
                where: {
                    type: query.type,
                    fileFormat: query.fileFormat,
                    status: query.status ? query.status : allowedStatuses,
                    tags: query.tags ? { [Op.contains]: query.tags } : undefined

                },
                limit: query.limit ?? undefined,
                offset: query.page && query.limit ? ((query.page - 1) * query.limit) : undefined,
                order: [[`createdAt`, `DESC`]]
            }).then(assets => {
                let response = assets.map(asset => asset.getApiV3Response());
                res.status(200).json({ assets: response, total: assets.length, page: query.page ?? null});
            }).catch(err => {
                res.status(500).json({ error: `Error fetching assets: ${parseErrorMessage(err)}` });
            });
        });

        router.get(`/assets/:id`, auth(`any`, true), (req, res) => {
            const { responded, data: id } = validate(req, res, `params`, Validator.zNumberID);
            if (responded) {
                return;
            }

            Asset.findByPk(id).then(asset => {
                if (!asset) {
                    res.status(404).json({ error: `Asset not found` });
                    return;
                }

                if (!asset.canView(req.auth.user)) {
                    res.status(403).json({ error: `You are not allowed to view this asset` });
                    return;
                }
                
                res.status(200).json(asset.getApiV3Response());
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