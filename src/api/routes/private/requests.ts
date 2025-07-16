import { Router } from "express";
import { auth, validate } from "../../../api/RequestUtils.ts";
import { AssetRequest, RequestType, UserRole } from "../../../shared/Database.ts";
import { Validator } from "../../../shared/Validator.ts";
import { request } from "http";

export class RequestRoutes {
    public static loadRoutes(router: Router): void {
        router.get(`/requests`, auth(`loggedIn`, true), (req, res) => {
            const { responded, data } = validate(req, res, `query`, Validator.z.object({ includeActioned: Validator.z.boolean().default(false) }));
            if (!req.auth.isAuthed || responded) {
                return;
            }

            let isElevated = req.auth.user.roles.includes(UserRole.Admin) || req.auth.user.roles.includes(UserRole.Moderator);

            AssetRequest.findAll({
                where: {
                    accepted: data.includeActioned ? undefined : false,
                    requestResponseBy: isElevated ? undefined : req.auth.user.id
                }
            }).then(requests => {
                if (requests.length === 0) {
                    res.status(204).json({ message: `No requests found` });
                    return;
                }

                res.status(200).json(requests.map(r => r.toAPIResponse()));
            }).catch(err => {
                res.status(500).json({ error: `Error fetching requests: ${err.message}` });
            });
        });

        router.post(`/requests/:id/decline`, auth(`loggedIn`, true), (req, res) => {
            const { responded: queryResponse, data: id } = validate(req, res, `params`, Validator.zNumberID);
            if (!req.auth.isAuthed || queryResponse) {
                return;
            }

        });
    }
}