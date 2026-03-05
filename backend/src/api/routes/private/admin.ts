import { Alert, dbId, User, UserPermissions, userPermissionsSchema } from "../../../shared/Database.ts";
import { Validator } from "../../../shared/Validator.ts";
import z from "zod/v4";
import { dedupeArray } from "../../../shared/Tools.ts";
import { loggedInProcedure, router } from "../../trpc.ts";
import { Logger } from "../../../shared/Logger.ts";
import { importFromOldModelSaber } from "../../../shared/Importer.ts";
import { TRPCError } from "@trpc/server";
import { EnvConfig } from "../../../shared/EnvConfig.ts";

export const AdminRouter = router({
    setRoles: loggedInProcedure([UserPermissions.Users_EditAllRoles])
        .input(z.object({
            userId: dbId,
            permissions: z.object({
                sitewide: z.array(z.enum(UserPermissions)),
                perGame: z.record(z.string(), z.array(z.enum(UserPermissions))),
            })
        }))
        .mutation(async ({ input, ctx }) => {
            let targetUser = await User.findByPk(input.userId);
            if (!targetUser) {
                throw new Error(`User not found`);
            }
            
            targetUser.permissions = input.permissions;
            targetUser.save().then((u) => {
                Logger.log(`Successfully saved roles for user ${targetUser.id}: ${JSON.stringify(targetUser.permissions)}`);
                return { message: `User roles updated successfully`, user: u };
            }).catch((e) => {
                Logger.error(`Error saving user roles for user ${targetUser.id}: ${e}`);
                throw new Error(`Failed to save user roles`);
            });
        }),
    createAlert: loggedInProcedure([UserPermissions.Users_EditAll, UserPermissions.Users_Ban])
        .input(Alert.validatorCreation.pick({
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
    importOldModelSaberData: loggedInProcedure([UserPermissions.Administative_Tasks])
        .mutation(async ({ input, ctx }) => {
            importFromOldModelSaber((message, level) => {});
        }),
    getAdminLogs: loggedInProcedure([UserPermissions.Administative_Tasks])
        .query(async ({ input, ctx }) => {
            return Logger.getLogs(new Date(Date.now() - 1000 * 60 * 5)); // last 5 minutes
        }),
    resetSchema: loggedInProcedure([UserPermissions.Administative_Tasks])
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
    importFakeData: loggedInProcedure([UserPermissions.Administative_Tasks])
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