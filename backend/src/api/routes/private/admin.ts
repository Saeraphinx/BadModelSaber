import { Router } from "express";
import { Alert, User, UserPermissions } from "../../../shared/Database.ts";
import { Validator } from "../../../shared/Validator.ts";
import z from "zod/v4";
import { dedupeArray } from "../../../shared/Tools.ts";
import { authProcedure, router } from "../../../api/trpc.ts";

export const AdminRouter = router({
    setRoles: authProcedure([UserPermissions.Manage_All_Users, UserPermissions.Manage_NonMod_Users])
        .input(z.object({
            userId: Validator.zNumberIDTransform,
            add: Validator.z.array(Validator.z.enum(UserPermissions))
                .optional()
                .default([]),
            remove: Validator.z.array(Validator.z.enum(UserPermissions))
                .optional()
                .default([]),
        }).refine(data => {
            // Ensure that at least one of add or remove is non-empty
            return (data.add.length > 0 || data.remove.length > 0);
        }, {
            message: "At least one of 'add' or 'remove' must be a non-empty array.",
        }))
        .mutation(async ({ input, ctx }) => {
            // check user persmissions to see if they can assign/remove the specificed roles
            for (let role of [...input.add, ...input.remove]) {
                if (role !== UserPermissions.View_Pending_Assets && 
                    role !== UserPermissions.Create_Assets) {
                    if (!ctx.user.roles.includes(UserPermissions.Manage_All_Users)) {
                        throw new Error(`You do not have permission to manage the role: ${role}`);
                    }
                }
            }

            let targetUser = await User.findByPk(input.userId);
            if (!targetUser) {
                throw new Error(`User not found`);
            }

            if (input.add) {
                targetUser.roles = dedupeArray([...targetUser.roles, ...input.add]);
            }

            if (input.remove) {
                targetUser.roles = targetUser.roles.filter(role => !input.remove.includes(role));
            }
            await targetUser.save();
            return { message: `User roles updated successfully`, roles: targetUser.roles };
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