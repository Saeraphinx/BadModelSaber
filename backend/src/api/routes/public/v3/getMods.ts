import { Logger } from "../../../../shared/Logger.ts";
import { GameVersion, GameVersionWhereOptions, Project, ProjectApiV3, projectApiV3Schema, Status, User, Version, versionApiV3Schema } from "../../../../shared/Database.ts";
import { anyProcedure, gameProcedure, router } from "../../../trpc.ts";
import z from "zod/v4";
import { TRPCError } from "@trpc/server";
import { Op } from "sequelize";

export const GetModsV3 = router({
    // #region getMods
    getMods: gameProcedure()
        .meta({
            openapi: {
                method: `GET`,
                path: `/v3/mods`,
                tags: ['Mods'],
            }
        })
        .input(z.object({
            gameVersion: z.string().optional(),
            status: z.array(z.enum(Status)).optional().default([Status.Verified, Status.Pending]),
            name: z.string().optional(),
            authors: z.array(z.int()).optional(),
            platform: z.string().optional(),
        }))
        .output(z.array(z.object({
            project: projectApiV3Schema,
            version: versionApiV3Schema
        })))
        .query(async ({ ctx, input }) => {
            let gvWhereOptions: GameVersionWhereOptions = {
                gameName: input.gameName
            }
            if (input.gameVersion) {
                gvWhereOptions = {
                    ...gvWhereOptions,
                    version: input.gameVersion
                };
            }   

            const availableGameVerison = await GameVersion.findOne({
                where: gvWhereOptions,
                attributes: ['id']
            }).then(gv => gv ? gv.id : null);

            if (!availableGameVerison) {
                throw new TRPCError({ code: 'NOT_FOUND', message: 'No game versions found for the specified game and version.' });
            }

            let versions = await Version.findAll({
                where: {
                    supportedGameVersionIds: {
                        [Op.contains]: [availableGameVerison]
                    },
                    status: input.status
                },
                include: [{all: true}]
            });

            let output = await Promise.all(versions.filter(v => v.canView(ctx.user)).map(async v => ({
                project: await (await v.project)?.toApiV3() as ProjectApiV3,
                version: await v.toApiV3()
            }))).catch(err => {
                Logger.warn("Error parsing mods for GetModsV3:");
                Logger.warn(err);
                throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR', message: 'An error occurred while parsing mods.' }); 
            });

            // these filters are applied after the db query because only the version table is pulled from the db
            if (input.name) {
                output = output.filter(o => o.project.name.toLowerCase().includes(input.name!.toLowerCase()));
            }

            if (input.authors) {
                output = output.filter(o => o.project.authors.some(a => {
                    if (Array.isArray(input.authors)) {
                        return input.authors.includes(a.id);
                    } else {
                        return a.id === input.authors;
                    }
                }));
            }

            return output;
        }),
    // #endregion
    // #region getProject
    getProject: anyProcedure()
        .input(z.object({
            projectId: z.number()
        }))
        .output(projectApiV3Schema)
        .query(async ({ ctx, input }) => {
            let project = await Project.findByPk(input.projectId);
            if (!project) {
                throw new TRPCError({ code: 'NOT_FOUND', message: 'Project not found.' });
            }
            if (!project.canView(ctx.user)) {
                throw new TRPCError({ code: 'FORBIDDEN', message: 'You do not have permission to view this project.' });
            }
            return await project.toApiV3() as ProjectApiV3;
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
            if (!project.canView(ctx.user)) {
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
    // #region getProjectAndVersions
    getProjectAndVerions: anyProcedure()
        .meta({
            openapi: {
                method: `GET`,
                path: `/v3/project/{projectId}`,
                tags: ['Mods'],
            }
        })
        .input(z.object({
            projectId: z.number()
        }))
        .output(z.object({
            project: projectApiV3Schema,
            versions: z.array(versionApiV3Schema)
        }))
        .query(async ({ ctx, input }) => {
            let project = await Project.findByPk(input.projectId);
            if (!project) {
                throw new TRPCError({ code: 'NOT_FOUND', message: 'Project not found.' });
            }
            if (!project.canView(ctx.user)) {
                throw new TRPCError({ code: 'FORBIDDEN', message: 'You do not have permission to view this project.' });
            }
            let versions = await Version.findAll({
                where: {
                    projectId: project.id
                }
            });
            versions = versions.filter(async v => await v.canView(ctx.user, project));
            let outputVersions = await Promise.all(versions.map(async v => await v.toApiV3()));
            return {
                project: await project.toApiV3() as ProjectApiV3,
                versions: outputVersions
            };
        })
    // #endregion
})