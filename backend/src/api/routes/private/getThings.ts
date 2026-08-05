import { TRPCError } from "@trpc/server";
import { Op } from "sequelize";
import z from "zod";
import { Project, ProjectApiV3, versionApiV3Schema, Version, User, GameVersion, UserPermissions, Status, assetApiV3Schema, projectApiV3Schema, Asset, Tags } from "../../../shared/Database.ts";
import { anyGameProcedure, anyProcedure, loggedInProcedure, router } from "../../trpc.ts";
import fs from "fs";
import { createPatch, diffLines, lineDiff } from "diff";
import { Sequelize } from "sequelize-typescript";
import { parseErrorMessage } from "../../../shared/Tools.ts";

export const getThingsInternalRouter = router({
    // #region getProject
    getProject: anyProcedure()
        .input(z.object({
            projectId: z.number()
        }))
        .query(async ({ ctx, input }) => {
            let project = await Project.findByPk(input.projectId);
            if (!project) {
                throw new TRPCError({ code: 'NOT_FOUND', message: 'Project not found.' });
            }
            if (!(await project.canView(ctx.user))) {
                throw new TRPCError({ code: 'FORBIDDEN', message: 'You do not have permission to view this project.' });
            }
            return await project.toApiV3() as ProjectApiV3;
        }),
    getBulkProjects: anyProcedure()
        .input(z.object({
            projectIds: z.array(z.number())
        }))
        .query(async ({ ctx, input }) => {
            let projects = await Project.findAll({
                where: {
                    id: {
                        [Op.in]: input.projectIds
                    }
                },
                include: [{ all: true }]
            });
            projects = projects.filter(async p => await p.canView(ctx.user));
            return await Promise.all(projects.map(async p => await p.toApiV3() as ProjectApiV3));
        }),
    // #endregion
    // #region searchProjects
    searchProjects: anyProcedure()
        .input(z.object({
            query: z.string(),
            gameName: z.string()
        }))
        .query(async ({ ctx, input }) => {
            let projects = await Project.findAll({
                where: {
                    name: {
                        [Op.iLike]: `%${input.query}%`
                    },
                    gameName: input.gameName
                },
                attributes: [`id`, `name`, `gameName`, `nameId`, `status`],
                include: [{
                    model: User,
                    attributes: [`id`, 'permissions']
                }]
            });

            projects = projects.filter(async p => await p.canView(ctx.user));
            return projects.map(p => {
                return {
                    id: p.id as number,
                    name: p.name,
                    nameId: p.nameId,
                }
            });
        }),
    // #endregion
    // #region searchProjectsByNameId
    searchProjectsByNameId: anyProcedure()
        .input(z.object({
            nameIds: z.array(z.string()),
            gameName: z.string()
        }))
        .query(async ({ ctx, input }) => {
            let projects = await Project.findAll({
                where: {
                    nameId: {
                        [Op.in]: input.nameIds
                    },
                    gameName: input.gameName,
                    status: Status.Public
                },
                attributes: [`id`, `name`, `gameName`, `nameId`, `status`],
                include: [{
                    model: User,
                    attributes: [`id`, 'permissions']
                }]
            });

            projects = projects.filter(async p => await p.canView(ctx.user));
            return projects.map(p => {
                return {
                    id: p.id as number,
                    name: p.name,
                    nameId: p.nameId,
                }
            });
        }),
    // #endregion
    // #region approvalQueue
    approvalQueueVersions: anyGameProcedure({ hasAllOf: [UserPermissions.Mods_ViewAll, UserPermissions.Mods_Approval] })
        .query(async ({ ctx, input }) => {
            let versions = await Version.findAll({
                where: {
                    status: [Status.Queue, Status.Testing],
                },
                include: [{
                    model: Project,
                    where: {
                        gameName: input.gameName
                    },
                    include: [{
                        model: User,
                    }]
                }, {
                    model: GameVersion,
                }],
            });

            let output = await Promise.all(versions
                .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime()) // sort versions in descending order
                .map(async v => {
                    let project = await v.project;
                    if (!project) {
                        throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR', message: `Project ${v.projectId} not found for version ${v.id}.` });
                    }
                    return {
                        project: project,
                        version: v,
                    }
                }))

            let outputApi = await Promise.all(output.map(async o => ({
                project: await o.project.toApiV3() as ProjectApiV3,
                version: await o.version.toApiV3()
            })));

            return outputApi;
        }),
    // #endregion
    // #region generateDiff
    generateDiff: loggedInProcedure({ hasAllOf: [UserPermissions.Mods_ViewAll, UserPermissions.Mods_Approval] })
        .input(z.object({
            versionId1: z.number(),
            versionId2: z.number()
        }))
        .query(async ({ ctx, input }) => {
            let version1 = await Version.findByPk(input.versionId1, { include: [Project] });
            let version2 = await Version.findByPk(input.versionId2, { include: [Project] });

            if (!version1 || !version2) {
                throw new TRPCError({ code: 'NOT_FOUND', message: 'One or both versions not found.' });
            }

            if (version1.projectId !== version2.projectId) {
                throw new TRPCError({ code: 'BAD_REQUEST', message: 'Versions belong to different projects.' });
            }

            if (!(await version1.canView(ctx.user)) || !(await version2.canView(ctx.user))) {
                throw new TRPCError({ code: 'FORBIDDEN', message: 'You do not have permission to view one or both versions.' });
            }

            if (!version1.doesDecompiledVersionExist() || !version2.doesDecompiledVersionExist()) {
                throw new TRPCError({ code: 'BAD_REQUEST', message: 'Decompiled version for at least one of the versions does not exist.' });
            }

            let code1 = fs.readFileSync(version1.decompiledPath, 'utf-8');
            let code2 = fs.readFileSync(version2.decompiledPath, 'utf-8');

            let diff = diffLines(code1, code2);
            return diff;
        }),
    // #endregion
    getFrontPageIcons: anyProcedure()
        .output(z.array(assetApiV3Schema.or(projectApiV3Schema)))
        .query(async ({ ctx }) => {
            try {
                const assets = await Asset.findAll({
                    where: {
                        status: Status.Verified,
                    },
                    limit: 10,
                    order: [
                        [Sequelize.fn('array_position', Sequelize.col('tags'), Tags.Featured), 'ASC'],
                        [Sequelize.fn('array_position', Sequelize.col('tags'), Tags.Contest), 'ASC'],
                        ['createdAt', 'DESC']
                    ],
                    include: { all: true }
                });
                const projects = await Project.findAll({
                    where: {
                        status: Status.Public,
                        isFeatured: true,
                    },
                    limit: 10,
                    order: [['createdAt', 'DESC']],
                    include: { all: true }
                });
                let response = await Promise.all([...assets.map(asset => asset.toApiV3(), ...projects.map(project => project.toApiV3()))]);
                return response;
            } catch (err) {
                console.error(err);
                throw new TRPCError({ code: `INTERNAL_SERVER_ERROR`, message: `Error fetching front page assets: ${parseErrorMessage(err)}` });
            }
        })
})