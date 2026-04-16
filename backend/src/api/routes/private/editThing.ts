import z from "zod/v4";
import { Asset, ThingRequest, LinkedAssetLinkType, User, dbId, Project, DependencySchema, Version, UserPermissions } from "../../../shared/Database.ts";
import { getHashFromFile, parseErrorMessage } from "../../../shared/Tools.ts";
import { loggedInProcedure, router } from "../../trpc.ts";
import { TRPCError } from "@trpc/server";
import { SemVer } from "semver";
import { zfd } from "zod-form-data";
import { Validator } from "../../../shared/Validator.ts";
import path from "path";
import fs from "fs";
import { Logger } from "../../../shared/Logger.ts";

export const UpdateAssetRouter = router({
    // #region updateAsset
    updateAsset: loggedInProcedure().input(z.object({
        assetId: dbId,
        data: Asset.validator.pick({
            name: true,
            description: true,
            tags: true
        }).partial()
    })).mutation(async ({ input, ctx }) => {
        const asset = await Asset.findByPk(input.assetId);
        if (!asset) {
            throw new TRPCError({ code: 'NOT_FOUND', message: `Asset not found` });
        }
        if (!asset.canEdit(ctx.user)) {
            throw new TRPCError({ code: 'FORBIDDEN', message: `You are not allowed to edit this asset` });
        }
        asset.updateAsset(input.data, ctx.user).then(updatedAsset => {
            return updatedAsset.toApiV3();
        }).catch(err => {
            throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR', message: `Error updating asset: ${parseErrorMessage(err)}` });
        });
    }),
    // #endregion
    // #region submitForApproval
    submitAssetForApproval: loggedInProcedure().input(z.object({
        assetId: dbId
    })).mutation(async ({ input, ctx }) => {
        const asset = await Asset.findByPk(input.assetId);
        if (!asset) {
            throw new TRPCError({ code: `NOT_FOUND`, message: `Asset not found` });
        }
        if (!asset.canEdit(ctx.user)) {
            throw new TRPCError({ code: `FORBIDDEN`, message: `You are not allowed to edit this asset` });
        }
        return await asset.submitForApproval(ctx.user).then(updatedAsset => {
            return updatedAsset.toApiV3();
        }).catch(err => {
            throw new TRPCError({ code: `INTERNAL_SERVER_ERROR`, message: `Error submitting asset for approval: ${parseErrorMessage(err)}` });
        });
    }),
    // #endregion
    // #region linkAsset
    linkAsset: loggedInProcedure().input(z.object({
        assetId: dbId,
        linkToId: dbId,
        type: z.enum(LinkedAssetLinkType)
    })).mutation(async ({ input, ctx }) => {
        const asset = await Asset.findByPk(input.assetId);
        if (!asset) {
            throw new TRPCError({ code: 'NOT_FOUND', message: `Asset not found` });
        }
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
    // #endregion
    // #region addAssetCollaborator
    addAssetCollaborator: loggedInProcedure().input(z.object({
        id: dbId,
        userId: dbId
    })).mutation(async ({ input, ctx }) => {
        const asset = await Asset.findByPk(input.id);
        if (!asset) {
            throw new TRPCError({ code: 'NOT_FOUND', message: `Asset not found` });
        }
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
    // #endregion
    // #region updateProject
    updateProject: loggedInProcedure().input(z.object({
        projectId: dbId,
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
        const project = await Project.findByPk(input.projectId);
        if (!project) {
            throw new TRPCError({ code: 'NOT_FOUND', message: `Project not found` });
        }
        if (!project.canEdit(ctx.user)) {
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
        projectId: dbId,
        icon: zfd.file().refine((file) => Validator.validateThumbnail(file), { message: "Invalid icon file format" })
    })).mutation(async ({ input, ctx }) => {
        const project = await Project.findByPk(input.projectId);
        if (!project) {
            throw new TRPCError({ code: 'NOT_FOUND', message: `Project not found` });
        }
        if (!project.canEdit(ctx.user)) {
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
            return updatedProject.toApiV3();
        }).catch(err => {
            Logger.error(`Error updating project with new icon path: ${err.message}`)
            throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR', message: 'Failed to update project with new icon. Please contact a site administrator.' });
        });
    }),
    // #endregion
    // #region updateVersion
    updateVersion: loggedInProcedure().input(z.object({
        versionId: dbId,
        data: z.object({
            semver: z.string().transform(val => {
                let sv = new SemVer(val); // this will throw if the semver is invalid
                return sv;
            }),
            supportedGameVersionIds: z.array(dbId),
            dependencies: z.array(DependencySchema)
        }).strict().partial()
    })).mutation(async ({ input, ctx }) => {
        const version = await Version.findByPk(input.versionId);
        if (!version) {
            throw new TRPCError({ code: 'NOT_FOUND', message: `Version not found` });
        }

        const project = await version.project;
        if (!project) {
            throw new TRPCError({ code: 'NOT_FOUND', message: `Project not found` });
        }

        if (!version.canEdit(ctx.user, project)) {
            throw new TRPCError({ code: 'FORBIDDEN', message: `You are not allowed to edit this version` });
        }

        return await version.updateVersion(input.data, ctx.user).then(async updatedVersion => {
            return await updatedVersion.toApiV3();
        }).catch(err => {
            throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR', message: `Error updating version: ${parseErrorMessage(err)}` });
        });
    }),
    // #endregion
})
/*
export class UpdateAssetRoutes {
    public static loadRoutes(router: Router): void {
        router.put(`/assets/:id`, auth(`loggedIn`, true), async (req, res) => {
            const { responded: qResponded, data: pData } = validate(req, res, `params`, Validator.z.object({
                id: Validator.zNumberID
            }));
            const { responded: bResponded, data: body } = validate(req, res, `body`, Asset.validator.pick({
                name: true,
                description: true,
                tags: true
            }).partial());
            if (!req.auth.isAuthed || qResponded || bResponded) {
                return;
            }
            

            let asset = await Asset.findByPk(pData.id);
            if (!asset) {
                res.status(404).json({ message: `Asset not found` });
                return;
            }

            if (!asset.canEdit(req.auth.user)) {
                res.status(403).json({ message: `You are not allowed to edit this asset` });
                return;
            }

            asset.updateAsset(body).then(updatedAsset => {
                res.status(200).json(updatedAsset.getApiResponse());
            }).catch(err => {
                res.status(500).json({ message: `Error updating asset: ${parseErrorMessage(err)}` });
            });
        });

        router.post(`/assets/:id/link`, auth(`loggedIn`, false), async (req, res) => {
            const { responded: qResponded, data: pData } = validate(req, res, `params`, Validator.z.object({
                id: Validator.zNumberID
            }));
            const { responded: bResponded, data: body } = validate(req, res, `body`, Validator.z.object({
                id: Validator.zNumberID,
                type: Validator.z.enum(LinkedAssetLinkType)
            }));
            if (!req.auth.isAuthed || qResponded || bResponded) {
                return;
            }

            let asset = await Asset.findByPk(pData.id);
            if (!asset) {
                res.status(404).json({ message: `Asset not found` });
                return;
            }

            if (!asset.canEdit(req.auth.user)) {
                res.status(403).json({ message: `You are not allowed to edit this asset` });
                return;
            }

            let otherAsset = await Asset.findByPk(body.id);
            if (!otherAsset) {
                res.status(404).json({ message: `Asset to link not found` });
                return;
            }

            asset.requestLink(req.auth.user, otherAsset, body.type).then(result => {
                if (result instanceof AssetRequest) {
                    res.status(202).json({ message: `Request created successfully`, request: result.getAPIResponse() });
                } else {
                    res.status(200).json({ message: `Asset linked successfully`, asset: result.getApiResponse() });
                }
            }).catch(err => {
                res.status(500).json({ message: `Error linking asset: ${parseErrorMessage(err)}` });
            });
        });

        router.post(`/assets/:id/collab`, auth(`loggedIn`, true), async (req, res) => {
            const { responded: qResponded, data: pData } = validate(req, res, `params`, Validator.z.object({
                id: Validator.zNumberID
            }));
            const { responded: bResponded, data: body } = validate(req, res, `body`, Validator.z.object({
                userId: Validator.zUserID
            }));
            if (!req.auth.isAuthed || qResponded || bResponded) {
                return;
            }

            let asset = await Asset.findByPk(pData.id);
            if (!asset) {
                res.status(404).json({ message: `Asset not found` });
                return;
            }

            if (!asset.canEdit(req.auth.user)) {
                res.status(403).json({ message: `You are not allowed to edit this asset` });
                return;
            }

            if (asset.collaborators.includes(body.userId)) {
                res.status(400).json({ message: `User is already a collaborator on this asset` });
                return;
            }

            let userToCredit = await User.findByPk(body.userId);
            if (!userToCredit) {
                res.status(404).json({ message: `User to credit not found` });
                return;
            }

            asset.requestCollab(req.auth.user, userToCredit).then(request => {
                res.status(202).json(request.getAPIResponse());
            }).catch(err => {
                res.status(500).json({ message: `Error adding collaborator: ${parseErrorMessage(err)}` });
            });
        })
    }
}
*/