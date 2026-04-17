import { TRPCError } from "@trpc/server";
import { Op } from "sequelize";
import z from "zod";
import { Project, ProjectApiV3, versionApiV3Schema, Version, User } from "../../../shared/Database.ts";
import { anyProcedure, router } from "../../trpc.ts";

export const getModsInternal = router({
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
                include: [{all: true}]
            });
            projects = projects.filter(async p => await p.canView(ctx.user));
            return await Promise.all(projects.map(async p => await p.toApiV3() as ProjectApiV3));
        }),
    // #endregion
    // #region getProjectVersions
    getProjectVerisons: anyProcedure()
        .input(z.object({
            projectId: z.number()
        }))
        .output(z.array(versionApiV3Schema))
        .query(async ({ ctx, input }) => {
            let project = await Project.findByPk(input.projectId);
            if (!project) {
                throw new TRPCError({ code: 'NOT_FOUND', message: 'Project not found.' });
            }
            if (!(await project.canView(ctx.user))) {
                throw new TRPCError({ code: 'FORBIDDEN', message: 'You do not have permission to view this project.' });
            }
            let versions = await Version.findAll({
                where: {
                    projectId: project.id
                }
            });
            versions = versions.filter(async v => await v.canView(ctx.user, project));
            let output = await Promise.all(versions.map(async v => await v.toApiV3()));
            return output;
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
                attributes: [`id`, `name`, `gameName`, `status`],
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
                }
            });
        }),
    // #endregion
})