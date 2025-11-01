import { Asset, AssetRequest, LinkedAssetLinkType, User } from "../../../shared/Database.ts";
import { Validator } from "../../../shared/Validator.ts";
import { parseErrorMessage } from "../../../shared/Tools.ts";
import { authProcedure, router } from "../../../api/trpc.ts";

export const UpdateAssetRouter = router({
    updateAsset: authProcedure(`loggedIn`).input(Validator.z.object({
        assetId: Validator.zNumberId,
        data: Asset.validator.pick({
            name: true,
            description: true,
            tags: true
        }).partial()
    })).mutation(async ({ input, ctx }) => {
        const asset = await Asset.findByPk(input.assetId);
        if (!asset) {
            throw new Error(`Asset not found`);
        }
        if (!asset.canEdit(ctx.user)) {
            throw new Error(`You are not allowed to edit this asset`);
        }
        asset.updateAsset(input.data, ctx.user).then(updatedAsset => {
            return updatedAsset.getApiResponse();
        }).catch(err => {
            throw new Error(`Error updating asset: ${parseErrorMessage(err)}`);
        });
    }),
    linkAsset: authProcedure(`loggedIn`).input(Validator.z.object({
        assetId: Validator.zNumberId,
        linkToId: Validator.zNumberId,
        type: Validator.z.enum(LinkedAssetLinkType)
    })).mutation(async ({ input, ctx }) => {
        const asset = await Asset.findByPk(input.assetId);
        if (!asset) {
            throw new Error(`Asset not found`);
        }
        if (!asset.canEdit(ctx.user)) {
            throw new Error(`You are not allowed to edit this asset`);
        }
        const otherAsset = await Asset.findByPk(input.linkToId);
        if (!otherAsset) {
            throw new Error(`Asset to link not found`);
        }

        return await asset.requestLink(ctx.user, otherAsset, input.type).then(result => {
            if (result instanceof AssetRequest) {
                return { message: `Request created successfully`, request: result.getAPIResponse() };
            } else {
                return { message: `Asset linked successfully`, asset: result.getApiResponse() };
            }
        }).catch(err => {
            throw new Error(`Error linking asset: ${parseErrorMessage(err)}`);
        });
    }),
    addCollaborator: authProcedure(`loggedIn`).input(Validator.z.object({
        id: Validator.zNumberId,
        userId: Validator.zUserID
    })).mutation(async ({ input, ctx }) => {
        const asset = await Asset.findByPk(input.id);
        if (!asset) {
            throw new Error(`Asset not found`);
        }
        if (!asset.canEdit(ctx.user)) {
            throw new Error(`You are not allowed to edit this asset`);
        }
        if (asset.collaborators.includes(input.userId)) {
            throw new Error(`User is already a collaborator on this asset`);
        }
        const userToCredit = await User.findByPk(input.userId);
        if (!userToCredit) {
            throw new Error(`User to credit not found`);
        }
        return asset.requestCollab(ctx.user, userToCredit).then(request => {
            return request.getAPIResponse();
        }).catch(err => {
            throw new Error(`Error adding collaborator: ${parseErrorMessage(err)}`);
        });
    })
})
/*
export class UpdateAssetRoutes {
    public static loadRoutes(router: Router): void {
        router.put(`/assets/:id`, auth(`loggedIn`, true), async (req, res) => {
            const { responded: qResponded, data: pData } = validate(req, res, `params`, Validator.z.object({
                id: Validator.zNumberID
            }));
            const { responded: bResponded, data: body } = validate(req, res, `body`, Asset.validator.pick({
                name: true,
                description: true,
                tags: true
            }).partial());
            if (!req.auth.isAuthed || qResponded || bResponded) {
                return;
            }
            

            let asset = await Asset.findByPk(pData.id);
            if (!asset) {
                res.status(404).json({ message: `Asset not found` });
                return;
            }

            if (!asset.canEdit(req.auth.user)) {
                res.status(403).json({ message: `You are not allowed to edit this asset` });
                return;
            }

            asset.updateAsset(body).then(updatedAsset => {
                res.status(200).json(updatedAsset.getApiResponse());
            }).catch(err => {
                res.status(500).json({ message: `Error updating asset: ${parseErrorMessage(err)}` });
            });
        });

        router.post(`/assets/:id/link`, auth(`loggedIn`, false), async (req, res) => {
            const { responded: qResponded, data: pData } = validate(req, res, `params`, Validator.z.object({
                id: Validator.zNumberID
            }));
            const { responded: bResponded, data: body } = validate(req, res, `body`, Validator.z.object({
                id: Validator.zNumberID,
                type: Validator.z.enum(LinkedAssetLinkType)
            }));
            if (!req.auth.isAuthed || qResponded || bResponded) {
                return;
            }

            let asset = await Asset.findByPk(pData.id);
            if (!asset) {
                res.status(404).json({ message: `Asset not found` });
                return;
            }

            if (!asset.canEdit(req.auth.user)) {
                res.status(403).json({ message: `You are not allowed to edit this asset` });
                return;
            }

            let otherAsset = await Asset.findByPk(body.id);
            if (!otherAsset) {
                res.status(404).json({ message: `Asset to link not found` });
                return;
            }

            asset.requestLink(req.auth.user, otherAsset, body.type).then(result => {
                if (result instanceof AssetRequest) {
                    res.status(202).json({ message: `Request created successfully`, request: result.getAPIResponse() });
                } else {
                    res.status(200).json({ message: `Asset linked successfully`, asset: result.getApiResponse() });
                }
            }).catch(err => {
                res.status(500).json({ message: `Error linking asset: ${parseErrorMessage(err)}` });
            });
        });

        router.post(`/assets/:id/collab`, auth(`loggedIn`, true), async (req, res) => {
            const { responded: qResponded, data: pData } = validate(req, res, `params`, Validator.z.object({
                id: Validator.zNumberID
            }));
            const { responded: bResponded, data: body } = validate(req, res, `body`, Validator.z.object({
                userId: Validator.zUserID
            }));
            if (!req.auth.isAuthed || qResponded || bResponded) {
                return;
            }

            let asset = await Asset.findByPk(pData.id);
            if (!asset) {
                res.status(404).json({ message: `Asset not found` });
                return;
            }

            if (!asset.canEdit(req.auth.user)) {
                res.status(403).json({ message: `You are not allowed to edit this asset` });
                return;
            }

            if (asset.collaborators.includes(body.userId)) {
                res.status(400).json({ message: `User is already a collaborator on this asset` });
                return;
            }

            let userToCredit = await User.findByPk(body.userId);
            if (!userToCredit) {
                res.status(404).json({ message: `User to credit not found` });
                return;
            }

            asset.requestCollab(req.auth.user, userToCredit).then(request => {
                res.status(202).json(request.getAPIResponse());
            }).catch(err => {
                res.status(500).json({ message: `Error adding collaborator: ${parseErrorMessage(err)}` });
            });
        })
    }
}
*/