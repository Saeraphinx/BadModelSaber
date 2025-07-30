import { Router } from "express";
import { auth, validate } from "../../../api/RequestUtils.ts";
import { Asset, AssetRequest, LinkedAssetLinkType, RequestType, User, UserRole } from "../../../shared/Database.ts";
import { Validator } from "../../../shared/Validator.ts";
import { request } from "http";
import { parseErrorMessage } from "../../../shared/Tools.ts";

export class UpdateUserRoutes {
    public static loadRoutes(router: Router): void {
        router.post(`/konami/:addOrRemove`, auth(`loggedIn`, false), async (req, res) => {
            const { responded, data: params } = validate(req, res, `params`, Validator.z.object({
                addOrRemove: Validator.z.enum([`add`, `remove`])
            }));
            if (!req.auth.isAuthed || responded) {
                return;
            }

            const user = await User.findByPk(req.auth.user.id);
            if (!user) {
                res.status(404).json({ message: `User not found` });
                return;
            }

            if (params.addOrRemove === `add`) {
                if (user.roles.includes(UserRole.Secret)) {
                    res.status(400).json({ message: `User already has the secret role` });
                    return;
                }
                user.roles = [...user.roles, UserRole.Secret];
            } else {
                if (!user.roles.includes(UserRole.Secret)) {
                    res.status(400).json({ message: `User does not have the secret role` });
                    return;
                }
                user.roles = user.roles.filter(role => role !== UserRole.Secret);
            }

            await user.save().then(() => {
                res.status(200).json({ message: `User updated successfully`, user: user.getApiResponse() });
            }).catch(err => {
                res.status(500).json({ message: `Error updating user: ${parseErrorMessage(err)}` });
            });
        });
    }
}