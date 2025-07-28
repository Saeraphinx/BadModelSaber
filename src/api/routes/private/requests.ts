import { Router } from "express";
import { auth, validate } from "../../../api/RequestUtils.ts";
import { AssetRequest, RequestType, UserRole } from "../../../shared/Database.ts";
import { Validator } from "../../../shared/Validator.ts";
import { request } from "http";
import { parseErrorMessage } from "../../../shared/Tools.ts";

export class RequestRoutes {
    public static loadRoutes(router: Router): void {
        router.get(`/requests`, auth(`loggedIn`, true), (req, res) => {
            const { responded, data } = validate(req, res, `query`, Validator.z.object({ 
                includeActioned: Validator.z.boolean().default(false),
                onlyMine: Validator.z.boolean().default(false),
                assetId: Validator.zNumberID.optional()
            }));
            if (!req.auth.isAuthed || responded) {
                return;
            }

            let isElevated = req.auth.user.roles.includes(UserRole.Admin) || req.auth.user.roles.includes(UserRole.Moderator);

            AssetRequest.findAll({
                where: {
                    accepted: data.includeActioned ? undefined : false,
                    requestResponseBy: isElevated ? undefined : req.auth.user.id,
                    requesterId: data.onlyMine ? req.auth.user.id : undefined,
                    refrencedAssetId: data.assetId
                }
            }).then(requests => {
                if (requests.length === 0) {
                    res.status(204).json();
                    return;
                }

                res.status(200).json(requests.map(r => r.getAPIResponse()));
            }).catch(err => {
                res.status(500).json({ message: `Error fetching requests: ${parseErrorMessage(err)}` });
            });
        });

        router.post(`/requests/:id/:action`, auth(`loggedIn`, true), async (req, res) => {
            const { responded: qResponded, data: pData } = validate(req, res, `params`, Validator.z.object({
                id: Validator.zNumberID,
                action: Validator.z.enum([`accept`, `decline`, `message`])
            }));
            if (!req.auth.isAuthed || qResponded) {
                return;
            }

            let assetReq = await AssetRequest.findByPk(pData.id);
            if (!assetReq) {
                res.status(404).json({ message: `Request not found` });
                return;
            }

            if (pData.action === `message`) {
                const { responded: bResponded, data: body } = validate(req, res, `body`, Validator.z.object({
                    message: Validator.z.string().min(1)
                }));
                if (bResponded) {
                    return;
                }

                if (!assetReq.allowedToMessage(req.auth.user)) {
                    res.status(403).json({ message: `You are not allowed to message this request` });
                    return;
                }

                await assetReq.addMessage(req.auth.user, body.message);
                res.status(200).json({ message: `Message added successfully` });
                return;
            } else {
                // Accept or decline the request
                if (!assetReq.allowedToAccept(req.auth.user)) {
                    res.status(403).json({ message: `You are not allowed to ${pData.action} this request` });
                    return;
                }

                let promise: Promise<any>;
                if (pData.action === `accept`) {
                    promise = assetReq.accept(req.auth.user.id);
                    res.status(200).json({ message: `Request accepted successfully` });
                } else if (pData.action === `decline`) {
                    promise = assetReq.decline(req.auth.user.id);
                    res.status(200).json({ message: `Request declined successfully` });
                } else {
                    res.status(400).json({ message: `Invalid action` });
                    return;
                }

                await promise.then(() => {
                    res.status(200).json({ message: `Request ${pData.action}${pData.action === `accept` ? `ed` : `d`} successfully.` });
                }).catch(err => {
                    res.status(500).json({ message: `Error processing request: ${parseErrorMessage(err)}` });
                });
                return;
            }
        });
    }
}