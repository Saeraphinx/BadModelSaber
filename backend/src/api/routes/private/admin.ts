import { Alert, User, UserPermissions } from "../../../shared/Database.ts";
import { Validator } from "../../../shared/Validator.ts";
import z from "zod/v4";
import { dedupeArray } from "../../../shared/Tools.ts";
import { authProcedure, router } from "../../../api/trpc.ts";
import { Logger } from "../../../shared/Logger.ts";
import { importFromOldModelSaber } from "../../../shared/Importer.ts";
import { TRPCError } from "@trpc/server";
import { EnvConfig } from "../../../shared/EnvConfig.ts";
import { createSchema } from "zod-openapi";

export const AdminRouter = router({
    setRoles: authProcedure([UserPermissions.Manage_All_Users])
        .input(z.object({
            userId: Validator.zUserID,
            roles: Validator.z.array(Validator.z.enum(UserPermissions)),
        }))
        .mutation(async ({ input, ctx }) => {
            let targetUser = await User.findByPk(input.userId);
            if (!targetUser) {
                throw new Error(`User not found`);
            }
            targetUser.roles = dedupeArray(input.roles);
            targetUser.save().then((u) => {
                Logger.log(`Successfully saved roles for user ${targetUser.id}: ${targetUser.roles.join(", ")}`);
                return { message: `User roles updated successfully`, user: u };
            }).catch((e) => {
                Logger.error(`Error saving user roles for user ${targetUser.id}: ${e}`);
                throw new Error(`Failed to save user roles`);
            });
        }),
    banUser: authProcedure([UserPermissions.Manage_All_Users, UserPermissions.Manage_NonMod_Users])
        .input(z.object({
            userId: Validator.zNumberId,
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
        .mutation(async ({ input, ctx }) => {
            let alert = await Alert.create(input);
            return alert;
        }),
    importOldModelSaberData: authProcedure([UserPermissions.Administative_Tasks])
        .mutation(async ({ input, ctx }) => {
            importFromOldModelSaber((message, level) => {});
        }),
    getAdminLogs: authProcedure([UserPermissions.Administative_Tasks])
        .query(async ({ input, ctx }) => {
            return Logger.getLogs(new Date(Date.now() - 1000 * 60 * 5)); // last 5 minutes
        }),
    resetSchema: authProcedure([UserPermissions.Administative_Tasks])
        .mutation(async ({ ctx }) => {
            if (!EnvConfig.isDevMode) {
                throw new TRPCError({ code: `FORBIDDEN`, message: `Cannot drop database schema in a non-development environment.` });
            }
            await ctx.db.dropSchema().catch((e) => {
                Logger.error(`Error dropping database schema by admin user ${ctx.userId}: ${e}`);
                throw new TRPCError({ code: `INTERNAL_SERVER_ERROR`, message: `Failed to drop database schema` });
            });
            await ctx.db.createSchema().catch((e) => {
                Logger.error(`Error creating database schema by admin user ${ctx.userId}: ${e}`);
                throw new TRPCError({ code: `INTERNAL_SERVER_ERROR`, message: `Failed to create database schema` });
            });
            await ctx.db.createAdminUserIfNotExists().catch((e) => {
                Logger.error(`Error creating admin user after schema reset by admin user ${ctx.userId}: ${e}`);
                throw new TRPCError({ code: `INTERNAL_SERVER_ERROR`, message: `Failed to create admin user` });
            });
            return { message: `Database schema reset successfully` };
        }),
    importFakeData: authProcedure([UserPermissions.Administative_Tasks])
        .mutation(async ({ ctx }) => {
            if (!EnvConfig.isDevMode) {
                throw new TRPCError({ code: `FORBIDDEN`, message: `Cannot import fake data in a non-development environment.` });
            }
            ctx.db.importFakeData().then(() => {
                Logger.log(`Fake data imported by admin user ${ctx.userId}`);
                return { message: `Fake data imported successfully` };
            }).catch((e) => {
                Logger.error(`Error importing fake data by admin user ${ctx.userId}: ${e}`);
                throw new TRPCError({ code: `INTERNAL_SERVER_ERROR`, message: `Failed to import fake data` });
            });
        }),
});