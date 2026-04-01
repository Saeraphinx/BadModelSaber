import z from "zod/v4";
import { Asset, ThingRequest, LinkedAssetLinkType, RequestType, User, UserPermissions } from "../../../shared/Database.ts";
import { Validator } from "../../../shared/Validator.ts";
import { loggedInProcedure, router } from "../../trpc.ts";
import { dedupeArray } from "../../../shared/Tools.ts";
import { TRPCError } from "@trpc/server";

export const konamiRouter = router({
    updateUser: loggedInProcedure([UserPermissions.Users_EditSelf]).input(z.object({
        displayName: User.validator.shape.displayName.optional(),
        bio: User.validator.shape.bio.optional()
    })).mutation(async ({ input, ctx }) => {
        if (input.displayName !== undefined) {
            ctx.user.displayName = input.displayName;
        }
        if (input.bio !== undefined) {
            ctx.user.bio = input.bio;
        }
        await ctx.user.save();
        return ctx.user.toApiV3();
    }),
    banUser: loggedInProcedure([UserPermissions.Users_Ban, UserPermissions.Users_EditAllRoles])
        .input(z.object({
            userId: z.number(),
            ban: z.boolean(),
        }))
        .mutation(async ({ input, ctx }) => {
            let targetUser = await User.findByPk(input.userId);
            if (!targetUser) {
                throw new TRPCError({ code: 'NOT_FOUND', message: `User not found` });
            }
            if (input.ban) {
                targetUser.permissions = {
                    sitewide: dedupeArray([...targetUser.permissions.sitewide.filter(r => 
                        r !== UserPermissions.Asset_Create && 
                        r !== UserPermissions.Mods_Create &&
                        r !== UserPermissions.Users_EditSelf &&
                        r !== UserPermissions.Secret_Features
                    ), UserPermissions.C_Banned]),
                    perGame: targetUser.permissions.perGame
                }
            } else {
                targetUser.permissions = {
                    sitewide: dedupeArray([...targetUser.permissions.sitewide, 
                        UserPermissions.Asset_Create, 
                        UserPermissions.Mods_Create,
                        UserPermissions.Users_EditSelf
                    ]),
                    perGame: targetUser.permissions.perGame
                }
            }
            targetUser.save();
        }),
    toggleSecretFeatures: loggedInProcedure({denied: [UserPermissions.C_Banned]}).input(z.object({
        enabled: z.boolean(),
    })).mutation(async ({ ctx }) => {
        if (ctx.user.checkRoles([UserPermissions.Secret_Features])) {
            ctx.user.permissions.sitewide = ctx.user.permissions.sitewide.filter(r => r !== UserPermissions.Secret_Features);
        } else {
            ctx.user.permissions = {
                sitewide: dedupeArray([...ctx.user.permissions.sitewide, UserPermissions.Secret_Features]),
                perGame: ctx.user.permissions.perGame
            };
        }
        await ctx.user.save();
    })
});
