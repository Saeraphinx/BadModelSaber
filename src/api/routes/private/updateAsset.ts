import { Router } from "express";
import { auth, validate } from "../../../api/RequestUtils.ts";
import { Asset, AssetRequest, LinkedAssetLinkType, RequestType, User, UserRole } from "../../../shared/Database.ts";
import { Validator } from "../../../shared/Validator.ts";
import { request } from "http";
import { parseErrorMessage } from "../../../shared/Tools.ts";

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