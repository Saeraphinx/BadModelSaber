import { Router } from "express";
import { auth, validate } from "../RequestUtils.ts";
import { Validator } from "../../shared/Validator.ts";
import { Asset } from "../../shared/Database.ts";
import { Op } from "sequelize";
import { parseErrorMessage } from "../../shared/Tools.ts";

export class GetAssetRoutes {
    public loadRoutes(router: Router): void {
        router.get(`/assets`, auth(`any`, true), (req, res) => {
            const { responded, data: query } = validate(req, res, `query`, Validator.zFilterAsset);
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
                    //tags: query.tags ? { [Op.contains]: query.tags } : undefined
                },
                limit: query.limit,
                offset: (query.page - 1) * query.limit,
                order: [[`createdAt`, `DESC`]]
            }).then(assets => {
                let response = assets.map(asset => asset.getApiResponse());
                res.json(response);
            }).catch(err => {
                res.status(500).json({ error: `Error fetching assets: ${parseErrorMessage(err)}` });
            });
        });
    }
}