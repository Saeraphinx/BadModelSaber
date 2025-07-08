import { Router } from "express";
import { auth, validate } from "../RequestUtils.ts";
import { Asset, UserRole } from "../../shared/Database.ts";
import { Validator } from "../../shared/Validator.ts";
import { parseErrorMessage } from "../../shared/Tools.ts";

export class ApprovalRoutes {
    public static loadRoutes(router: Router): void {
        router.post(`/approvals/assets/{id}`, auth([UserRole.Moderator]), (req, res) => {
            const { responded: pResponded, data: id } = validate(req, res, `params`, Validator.zAssetID);
            const { responded: dResponded, data: body } = validate(req, res, `body`, Validator.zApprovalObj);
            if (pResponded || dResponded || req.auth.isAuthed === false) {
                return;
            }
        
            Asset.findByPk(id).then(asset => {
                if (!asset) {
                    res.status(404).json({ error: `Asset not found` });
                    return;
                }
        
                asset.setStatus(body.status, body.reason, req.auth.user!.id).then((asset) => {
                    res.status(200).json({
                        message: `Asset status updated successfully`,
                        asset: asset.getApiResponse()
                    });
                }).catch(err => {
                    res.status(500).json({ error: `Error updating asset status: ${parseErrorMessage(err)}` });
                    return;
                });
            }).catch(err => {
                res.status(500).json({ error: `Error fetching asset: ${parseErrorMessage(err)}` });
                return;
            });
        });
    }
}
