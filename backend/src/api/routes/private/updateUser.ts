import { auth, validate } from "../../../api/RequestUtils.ts";
import { Asset, AssetRequest, LinkedAssetLinkType, RequestType, User, UserPermissions } from "../../../shared/Database.ts";
import { Validator } from "../../../shared/Validator.ts";
import { request } from "http";
import { parseErrorMessage } from "../../../shared/Tools.ts";
import { authProcedure, router } from "../../../api/trpc.ts";

export const konamiRouter = router({
    konami: authProcedure(`loggedIn`).input(Validator.z.enum([`add`, `remove`])).mutation(async ({input, ctx}) => {
        if (input === `add`) {
            if (ctx.user.roles.includes(UserPermissions.View_Pending_Assets)) {
                throw new Error(`User already has the secret role`);
            }
            ctx.user.roles = [...ctx.user.roles, UserPermissions.View_Pending_Assets];
        } else if (input === `remove`) {
            if (!ctx.user.roles.includes(UserPermissions.View_Pending_Assets)) {
                throw new Error(`User does not have the secret role`);
            }
            ctx.user.roles = ctx.user.roles.filter(role => role !== UserPermissions.View_Pending_Assets);
        }
        await ctx.user.save();
        return ctx.user.getApiResponse();
    })
});
/*
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
                if (user.roles.includes(UserPermissions.View_Pending_Assets)) {
                    res.status(400).json({ message: `User already has the secret role` });
                    return;
                }
                user.roles = [...user.roles, UserPermissions.View_Pending_Assets];
            } else {
                if (!user.roles.includes(UserPermissions.View_Pending_Assets)) {
                    res.status(400).json({ message: `User does not have the secret role` });
                    return;
                }
                user.roles = user.roles.filter(role => role !== UserPermissions.View_Pending_Assets);
            }

            await user.save().then(() => {
                res.status(200).json({ message: `User updated successfully`, user: user.getApiResponse() });
            }).catch(err => {
                res.status(500).json({ message: `Error updating user: ${parseErrorMessage(err)}` });
            });
        });
    }
}

*/