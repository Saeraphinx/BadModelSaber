import { Router } from "express";
import { auth, validate } from "../../RequestUtils.ts";
import { Asset, UserRole } from "../../../shared/Database.ts";
import { Validator } from "../../../shared/Validator.ts";
import { parseErrorMessage } from "../../../shared/Tools.ts";

export class ApprovalRoutes {
    public static loadRoutes(router: Router): void {
        router.post(`/assets/:id/approval`, auth([UserRole.Moderator]), async (req, res) => {
            const { responded: pResponded, data: params } = validate(req, res, `params`, Validator.zNumberIDObj);
            const { responded: dResponded, data: body } = validate(req, res, `body`, Validator.zApprovalObjv3);
            if (pResponded || dResponded || req.auth.isAuthed === false) {
                return;
            }
        
            await Asset.findByPk(params.id).then(async asset => {
                if (!asset) {
                    res.status(404).json({ message: `Asset not found` });
                    return;
                }
        
                await asset.setStatus(body.status, body.reason, req.auth.user!.id).then(async (asset) => {
                    res.status(200).json({
                        message: `Asset status updated successfully`,
                        asset: await asset.getApiV3Response()
                    });
                }).catch(err => {
                    res.status(500).json({ message: `Error updating asset status: ${parseErrorMessage(err)}` });
                    return;
                });
            }).catch(err => {
                res.status(500).json({ message: `Error fetching asset: ${parseErrorMessage(err)}` });
                return;
            });
        });
    }
}
