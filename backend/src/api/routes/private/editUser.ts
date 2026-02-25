import { Asset, AssetRequest, LinkedAssetLinkType, RequestType, User, UserPermissions } from "../../../shared/Database.ts";
import { Validator } from "../../../shared/Validator.ts";
import { authProcedure, router } from "../../trpc.ts";

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
