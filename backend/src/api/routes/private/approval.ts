import { Router } from "express";
import { auth, validate } from "../../RequestUtils.ts";
import { Asset, Status, UserPermissions } from "../../../shared/Database.ts";
import { Validator } from "../../../shared/Validator.ts";
import { parseErrorMessage } from "../../../shared/Tools.ts";
import { authProcedure, router } from "../../../api/trpc.ts";

export const approvalRouter = router({
    approveAsset: authProcedure([UserPermissions.Approve_Assets]).input(Validator.z.object({
        id: Validator.z.number().int().positive(),
        status: Validator.z.enum(Status),
        reason: Validator.z.string().max(1000).optional()
    })).mutation(async ({input, ctx}) => {
        const asset = await Asset.findByPk(input.id);
        if (!asset) {
            throw new Error(`Asset not found`);
        }
        await asset.setStatus(input.status, input.reason ?? `No reason given.`, ctx.user.id).then(() => {
            return asset.getApiV3Response();
        }).catch(err => {
            throw new Error(`Error updating asset status: ${parseErrorMessage(err)}`);
        });
    })
});

/*
export class ApprovalRoutes {
    public static loadRoutes(router: Router): void {
        router.post(`/assets/:id/approval`, auth([UserPermissions.Approve_Assets]), async (req, res) => {
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
*/