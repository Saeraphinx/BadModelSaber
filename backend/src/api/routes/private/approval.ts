import { Asset, Project, Status, UserPermissions, Version } from "../../../shared/Database.ts";
import { Validator } from "../../../shared/Validator.ts";
import { parseErrorMessage } from "../../../shared/Tools.ts";
import { loggedInProcedure, router } from "../../trpc.ts";
import z from "zod/v4";
import { TRPCError } from "@trpc/server";

export const approvalRouter = router({
    setStatusAsset: loggedInProcedure([UserPermissions.Asset_Approval]).input(z.object({
        id: z.number().int().positive(),
        status: z.enum(Status),
        reason: z.string().max(1000).optional()
    })).mutation(async ({input, ctx}) => {
        const asset = await Asset.findByPk(input.id);
        if (!asset) {
            throw new TRPCError({ code: 'NOT_FOUND', message: 'Asset not found' });
        }
        await asset.setStatus(input.status, ctx.user, input.reason ?? `No reason given.`).then(() => {
            return asset.toApiV3();
        }).catch(err => {
            throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR', message: `Error updating asset status: ${parseErrorMessage(err)}` });
        });
    }),
    setStatusProject: loggedInProcedure().input(z.object({
        id: z.number().int().positive(),
        status: z.enum(Status),
        reason: z.string().max(1000).optional()
    })).mutation(async ({input, ctx}) => {
        const mod = await Project.findByPk(input.id);
        if (!mod) {
            throw new TRPCError({ code: 'NOT_FOUND', message: 'Project not found' });
        }

        if (!ctx.user.checkRoles([UserPermissions.Mods_Approval], mod.gameName)) {
            throw new TRPCError({ code: 'FORBIDDEN', message: 'You do not have permission to approve this mod.' });
        }

        await mod.setStatus(input.status, ctx.user, input.reason ?? `No reason given.`).then(() => {
            return mod.toApiV3();
        }).catch(err => {
            throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR', message: `Error updating mod status: ${parseErrorMessage(err)}` });
        });
    }),
    setStatusVersion: loggedInProcedure([UserPermissions.Mods_Approval]).input(z.object({
        id: z.number().int().positive(),
        status: z.enum(Status),
        reason: z.string().max(1000).optional()
    })).mutation(async ({input, ctx}) => {
        const version = await Version.findByPk(input.id);
        if (!version) {
            throw new TRPCError({ code: 'NOT_FOUND', message: 'Version not found' });
        }

        await version.setStatus(input.status, ctx.user, input.reason ?? `No reason given.`).then(() => {
            return version.toApiV3();
        }).catch(err => {
            throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR', message: `Error updating version status: ${parseErrorMessage(err)}` });
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