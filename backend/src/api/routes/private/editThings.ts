import z from "zod/v4";
import { Asset, ThingRequest, LinkedAssetLinkType, User, dbId, Project, DependencySchema, Version, UserPermissions, Status } from "../../../shared/Database.ts";
import { dedupeArray, getHashFromFile, parseErrorMessage } from "../../../shared/Tools.ts";
import { loggedInAssetProcedure, loggedInProcedure, loggedInProjectProcedure, loggedInVersionProcedure, router } from "../../trpc.ts";
import { TRPCError } from "@trpc/server";
import { SemVer } from "semver";
import { zfd } from "zod-form-data";
import { Validator } from "../../../shared/Validator.ts";
import path from "path";
import fs from "fs";
import { Logger } from "../../../shared/Logger.ts";

export const updateThingsRouter = router({
    asset: {
        updateAsset: loggedInAssetProcedure().input(z.object({
            data: Asset.validator.pick({
                name: true,
                description: true,
                tags: true
            }).partial()
        })).mutation(async ({ input, ctx }) => {
            const asset = ctx.asset;
            if (!asset.canEdit(ctx.user)) {
                throw new TRPCError({ code: 'FORBIDDEN', message: `You are not allowed to edit this asset` });
            }
            asset.updateAsset(input.data, ctx.user).then(updatedAsset => {
                return updatedAsset.toApiV3();
            }).catch(err => {
                throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR', message: `Error updating asset: ${parseErrorMessage(err)}` });
            });
        }),
        submitAssetForApproval: loggedInAssetProcedure().mutation(async ({ input, ctx }) => {
            const asset = ctx.asset;
            if (!asset.canEdit(ctx.user)) {
                throw new TRPCError({ code: `FORBIDDEN`, message: `You are not allowed to edit this asset` });
            }
            return await asset.submitForApproval(ctx.user).then(updatedAsset => {
                return updatedAsset.toApiV3();
            }).catch(err => {
                throw new TRPCError({ code: `INTERNAL_SERVER_ERROR`, message: `Error submitting asset for approval: ${parseErrorMessage(err)}` });
            });
        }),
        addAssetLink: loggedInAssetProcedure().input(z.object({
            linkToId: dbId,
            type: z.enum(LinkedAssetLinkType)
        })).mutation(async ({ input, ctx }) => {
            const asset = ctx.asset;
            if (!asset.canEdit(ctx.user)) {
                throw new TRPCError({ code: 'FORBIDDEN', message: `You are not allowed to edit this asset` });
            }
            const otherAsset = await Asset.findByPk(input.linkToId);
            if (!otherAsset) {
                throw new TRPCError({ code: 'NOT_FOUND', message: `Asset to link not found` });
            }

            return await asset.requestLink(ctx.user, otherAsset, input.type).then(async result => {
                if (result instanceof ThingRequest) {
                    return { message: `Request created successfully`, request: await result.toApiV3() };
                } else {
                    return { message: `Asset linked successfully`, asset: await result.toApiV3() };
                }
            }).catch(err => {
                throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR', message: `Error linking asset: ${parseErrorMessage(err)}` });
            });
        }),
        addAssetCollaborator: loggedInAssetProcedure().input(z.object({
            // id: dbId,
            userId: dbId
        })).mutation(async ({ input, ctx }) => {
            const asset = ctx.asset;
            if (!asset.canEdit(ctx.user)) {
                throw new TRPCError({ code: 'FORBIDDEN', message: `You are not allowed to edit this asset` });
            }
            if (asset.collaboratorIds.includes(input.userId)) {
                throw new TRPCError({ code: 'BAD_REQUEST', message: `User is already a collaborator on this asset` });
            }
            const userToCredit = await User.findByPk(input.userId);
            if (!userToCredit) {
                throw new TRPCError({ code: 'NOT_FOUND', message: `User to credit not found` });
            }
            return asset.requestCollab(ctx.user, userToCredit).then(request => {
                return request.toApiV3();
            }).catch(err => {
                throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR', message: `Error adding collaborator: ${parseErrorMessage(err)}` });
            });
        }),
    },
    project: {
        updateProject: loggedInProjectProcedure().input(z.object({
            data: Project.validator.pick({
                description: true,
                collaboratorIds: true,
                category: true,
                summary: true,
                gitUrl: true,
            }).extend({
                authorIds: z.array(dbId).min(1),
            }).strict().partial()
        })).mutation(async ({ input, ctx }) => {
            const project = ctx.project;
            if (!(await project.canEdit(ctx.user))) {
                throw new TRPCError({ code: 'FORBIDDEN', message: `You are not allowed to edit this project` });
            }

            if (input.data.category) {
                if (input.data.category === 'Core' || input.data.category === 'Essential') {
                    if (!ctx.user.checkRoles([UserPermissions.Mods_Approval], project.gameName)) {
                        throw new TRPCError({ code: 'FORBIDDEN', message: `You do not have permission to set this category` });
                    }
                }
            }

            return project.updateProject(input.data, ctx.user).then(updatedProject => {
                return updatedProject.toApiV3();
            });
        }),
        updateProjectIcon: loggedInProcedure().input(zfd.formData({
            projectId: zfd.numeric(),
            icon: zfd.file().refine((file) => Validator.validateThumbnail(file), { message: "Invalid icon file format" })
        })).mutation(async ({ input, ctx }) => {
            const project = await Project.findByPk(input.projectId);
            if (!project) {
                throw new TRPCError({ code: 'NOT_FOUND', message: `Project not found` });
            }
            if (!(await project.canEdit(ctx.user))) {
                throw new TRPCError({ code: 'FORBIDDEN', message: `You are not allowed to edit this project` });
            }

            let iconFile = input.icon;
            let iconName = `${await getHashFromFile(iconFile)}${path.extname(iconFile.name)}`;
            await iconFile.arrayBuffer().then(async (buffer) => {
                fs.writeFileSync(path.join(project.folderPath, iconName), Buffer.from(buffer));
            }).catch((err) => {
                Logger.error(`Error saving project icon file: ${err.message}`)
                throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR', message: 'Failed to save project icon file. Please contact a site administrator.' });
            });

            project.iconFileName = iconName;
            return project.save().then(updatedProject => {
                Logger.info(`Project icon updated successfully to ${updatedProject.iconFileName} for project ${project.id} by user ${ctx.user.id}`);
                return updatedProject.toApiV3();
            }).catch(err => {
                Logger.error(`Error updating project with new icon path: ${err.message}`)
                throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR', message: 'Failed to update project with new icon. Please contact a site administrator.' });
            });
        }),
    },
    version: {
        updateVersion: loggedInVersionProcedure().input(z.object({
            data: z.object({
                semver: z.string().transform(val => {
                    let sv = new SemVer(val); // this will throw if the semver is invalid
                    return sv;
                }),
                supportedGameVersionIds: z.array(dbId),
                dependencies: z.array(DependencySchema)
            }).strict().partial()
        })).mutation(async ({ input, ctx }) => {
            const version = ctx.version;
            const project = ctx.project;

            if (!(await version.canEdit(ctx.user, project))) {
                throw new TRPCError({ code: 'FORBIDDEN', message: `You are not allowed to edit this version` });
            }

            return await version.updateVersion(input.data, ctx.user).then(async updatedVersion => {
                return await updatedVersion.toApiV3();
            }).catch(err => {
                throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR', message: `Error updating version: ${parseErrorMessage(err)}` });
            });
        }),
        submitForApproval: loggedInVersionProcedure().mutation(async ({ ctx }) => {
            const version = ctx.version;
            const project = ctx.project;

            if (!(await version.canEdit(ctx.user, project))) {
                throw new TRPCError({ code: 'FORBIDDEN', message: `You are not allowed to submit this version for approval` });
            }

            if (version.status !== Status.Private) {
                throw new TRPCError({ code: 'BAD_REQUEST', message: `Only private versions can be submitted for approval` });
            }

            return await version.setStatus(Status.Queue, ctx.user, `Submitting version for approval`).then(async updatedVersion => {
                return await updatedVersion.toApiV3();
            }).catch(err => {
                throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR', message: `Error submitting version for approval: ${parseErrorMessage(err)}` });
            });
        }),
        removeFromQueue: loggedInVersionProcedure().mutation(async ({ ctx }) => {
            const version = ctx.version;
            const project = ctx.project;

            if (!(await version.canEdit(ctx.user, project))) {
                throw new TRPCError({ code: 'FORBIDDEN', message: `You are not allowed to remove this version from the queue` });
            }

            if (version.status !== Status.Queue) {
                throw new TRPCError({ code: 'BAD_REQUEST', message: `Only versions in the queue can be removed` });
            }

            return await version.setStatus(Status.Private, ctx.user, `Removing version from queue by author`).then(async updatedVersion => {
                return await updatedVersion.toApiV3();
            }).catch(err => {
                throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR', message: `Error removing version from queue: ${parseErrorMessage(err)}` });
            });
        })  
    },
    user: {
        updateSelfUser: loggedInProcedure([UserPermissions.Users_EditSelf]).input(z.object({
            displayName: User.validator.shape.displayName.optional(),
            bio: User.validator.shape.bio.optional()
        })).mutation(async ({ input, ctx }) => {
            if (input.displayName !== undefined) {
                ctx.user.displayName = input.displayName;
            }
            if (input.bio !== undefined) {
                ctx.user.bio = input.bio;
            }
            Logger.info(`User ${ctx.user.id} (${ctx.user.username}) has updated their profile.`);
            await ctx.user.save();
            return ctx.user.toApiV3();
        }),
        toggleSecretFeatures: loggedInProcedure({ denied: [UserPermissions.C_Banned] }).input(z.object({
            enabled: z.boolean(),
        })).mutation(async ({ ctx, input }) => {
            if (!input.enabled) {
                ctx.user.permissions = {
                    sitewide: ctx.user.permissions.sitewide.filter(r => r !== UserPermissions.Secret_Features),
                    perGame: ctx.user.permissions.perGame
                };
                Logger.info(`User ${ctx.user.id} (${ctx.user.username}) has disabled secret features.`);
            } else {
                ctx.user.permissions = {
                    sitewide: dedupeArray([...ctx.user.permissions.sitewide, UserPermissions.Secret_Features]),
                    perGame: ctx.user.permissions.perGame
                };
                Logger.info(`User ${ctx.user.id} (${ctx.user.username}) has enabled secret features.`);
            }
            await ctx.user.save();
        })
    }

})
