import z from "zod";
import { anyProcedure, loggedInProcedure, router } from "../../trpc.ts";
import { Alert, Asset, Project, User, UserPermissions, Version } from "../../../shared/Database.ts";
import { TRPCError } from "@trpc/server";

let permissionsObj = { hasAllOf: [UserPermissions.Administrative_Tasks, UserPermissions.Asset_ViewAll, UserPermissions.Mods_ViewAll, UserPermissions.Asset_EditAll, UserPermissions.Mods_EditAll] };

export const AdminGetEditRouter = router({
    raw: {
        getUser: loggedInProcedure(permissionsObj).input(z.object({
            id: z.int().positive()
        })).query(async ({ input, ctx }) => {
            const user = await User.findByPk(input.id);
            if (!user) {
                throw new TRPCError({ code: 'NOT_FOUND', message: `User not found` });
            }
            return user.toJSON();
        }),
        editUser: loggedInProcedure(permissionsObj).input(User.validator.partial()).mutation(async ({ input, ctx }) => {
            const user = await User.findByPk(input.id);
            if (!user) {
                throw new TRPCError({ code: 'NOT_FOUND', message: `User not found` });
            }
            await user.update(input);
            return user.toJSON();
        }),
        getProject: loggedInProcedure(permissionsObj).input(z.object({
            id: z.int().positive()
        })).query(async ({ input, ctx }) => {
            const project = await Project.findByPk(input.id);
            if (!project) {
                throw new TRPCError({ code: 'NOT_FOUND', message: `Project not found` });
            }
            return project.toJSON();
        }),
        editProject: loggedInProcedure(permissionsObj).input(Project.validator.partial()).mutation(async ({ input, ctx }) => {
            const project = await Project.findByPk(input.id);
            if (!project) {
                throw new TRPCError({ code: 'NOT_FOUND', message: `Project not found` });
            }
            await project.update(input);
            return project.toJSON();
        }),
        getVersion: loggedInProcedure(permissionsObj).input(z.object({
            id: z.int().positive()
        })).query(async ({ input, ctx }) => {
            const version = await Version.findByPk(input.id);
            if (!version) {
                throw new TRPCError({ code: 'NOT_FOUND', message: `Version not found` });
            }
            return version.toJSON();
        }),
        editVersion: loggedInProcedure(permissionsObj).input(Version.validator.partial()).mutation(async ({ input, ctx }) => {
            const version = await Version.findByPk(input.id);
            if (!version) {
                throw new TRPCError({ code: 'NOT_FOUND', message: `Version not found` });
            }
            await version.update(input);
            return version.toJSON();
        }),
        getAsset: loggedInProcedure(permissionsObj).input(z.object({
            id: z.int().positive()
        })).query(async ({ input, ctx }) => {
            const asset = await Asset.findByPk(input.id);
            if (!asset) {
                throw new TRPCError({ code: 'NOT_FOUND', message: `Asset not found` });
            }
            return asset.toJSON();
        }),
        editAsset: loggedInProcedure(permissionsObj).input(Asset.validator.partial()).mutation(async ({ input, ctx }) => {
            const asset = await Asset.findByPk(input.id);
            if (!asset) {
                throw new TRPCError({ code: 'NOT_FOUND', message: `Asset not found` });
            }
            await asset.update(input);
            return asset.toJSON();
        }),
        createAlert: loggedInProcedure([UserPermissions.Administrative_Tasks, UserPermissions.Users_EditAll, UserPermissions.Users_Ban])
        .input(Alert.validatorCreation)
        .mutation(async ({ input, ctx }) => {
            // @ts-expect-error
            let alert = await Alert.create(input);
            return alert.toJSON();
        }),
    },
});