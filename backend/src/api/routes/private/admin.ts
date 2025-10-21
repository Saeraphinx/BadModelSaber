import { Router } from "express";
import { Alert, User, UserPermissions } from "../../../shared/Database.ts";
import { Validator } from "../../../shared/Validator.ts";
import z from "zod/v4";
import { dedupeArray } from "../../../shared/Tools.ts";
import { authProcedure, router } from "../../../api/trpc.ts";

export const AdminRouter = router({
    setRoles: authProcedure([UserPermissions.Manage_All_Users])
        .input(z.object({
            userId: Validator.zNumberIDTransform,
            roles: Validator.z.array(Validator.z.enum(UserPermissions)),
        }))
        .mutation(async ({ input, ctx }) => {
            let targetUser = await User.findByPk(input.userId);
            if (!targetUser) {
                throw new Error(`User not found`);
            }
            targetUser.roles = dedupeArray(input.roles);
            await targetUser.save();
            return { message: `User roles updated successfully`, roles: targetUser.roles };
        }),
    banUser: authProcedure([UserPermissions.Manage_All_Users, UserPermissions.Manage_NonMod_Users])
        .input(z.object({
            userId: Validator.zNumberIDTransform,
            ban: z.boolean(),
        }))
        .mutation(async ({ input, ctx }) => {
            let targetUser = await User.findByPk(input.userId);
            if (!targetUser) {
                throw new Error(`User not found`);
            }
            if (targetUser.roles.includes(UserPermissions.Manage_All_Users)) {
                throw new Error(`Cannot ban a user with ${UserPermissions.Manage_All_Users} permission`);
            }
            targetUser.roles = []
            targetUser.save();
        }),
    createAlert: authProcedure([UserPermissions.Manage_All_Users, UserPermissions.Manage_NonMod_Users])
        .input(Alert.createValidator.pick({
            header: true,
            message: true,
            type: true,
            requestId: true,
            assetId: true,
            userId: true,
        }))
        .mutation(async ({ input }) => {
            let alert = await Alert.create(input);
            return alert;
        }),
});