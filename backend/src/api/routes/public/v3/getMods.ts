import { Logger } from "../../../../shared/Logger.ts";
import { GameVersion, GameVersionWhereOptions, Project, ProjectApiV3, projectApiV3Schema, Status, User, UserPermissions, Version, versionApiV3Schema } from "../../../../shared/Database.ts";
import { anyGameProcedure, anyProcedure, gameProcedure, router } from "../../../trpc.ts";
import z from "zod/v4";
import { TRPCError } from "@trpc/server";
import { Op } from "sequelize";
import sequelize from "sequelize/lib/sequelize";
import { compare } from "semver";

export const GetModsV3 = router({
    // #region getMods
    getMods: anyGameProcedure()
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
            language: z.string().optional(),
        }))
        .output(z.array(z.object({
            project: projectApiV3Schema,
            version: versionApiV3Schema
        })))
        .query(async ({ ctx, input }) => {
            let timingString = ``;
            let startTime = Date.now();
            let gvWhereOptions: GameVersionWhereOptions = {
                gameName: input.gameName
            }
            if (input.gameVersion) {
                gvWhereOptions = {
                    ...gvWhereOptions,
                    version: input.gameVersion
                };
            }   

            const availableGameVerison = await GameVersion.findAll({
                where: gvWhereOptions,
                attributes: ['id']
            }).then(gv => gv.map(g => g.id));

            if (!availableGameVerison) {
                throw new TRPCError({ code: 'NOT_FOUND', message: 'No game versions found for the specified game and version.' });
            }
            
            let versions = await Version.findAll({
                where: {
                    supportedGameVersionIds: {                        
                        [Op.overlap]: availableGameVerison
                    },
                    status: input.status
                },
                order: [['projectId', 'DESC']],
                include: [{all: true}]
            }).then(v => {
                timingString += `db;dur=${Date.now() - startTime}`;
                startTime = Date.now();
                return v;
            });

            // filter to unique projects and versions that the user can view
            let filter1Start = Date.now();
            let output = await Promise.all(versions
                .sort((a, b) => compare(b.semver, a.semver)) // sort versions in descending order
                .filter((v, i, arr) => arr.findIndex(other => other.projectId === v.projectId) === i) // filter to unique projects
                .filter(v => v.canView(ctx.user)) // filter to versions the user can view
                .map(async v => ({
                    project: await v.project as Project,
                    version: v
                })
            )).catch(err => {
                Logger.warn("Error parsing mods for GetModsV3:");
                Logger.warn(err);
                throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR', message: 'An error occurred while parsing mods.' }); 
            }).then(v => {;
                timingString += `, filterp1;dur=${Date.now() - filter1Start}`;
                return v;
            });
            startTime = Date.now();

            // these filters are applied after the db query because only the version table is pulled from the db
            if (input.name) {
                output = output.filter(o => o.project.name.toLowerCase().includes(input.name!.toLowerCase()));
            }

            if (input.authors) {
                output = output.filter(o => o.project.authorIds.some(a => {
                    if (Array.isArray(input.authors)) {
                        return input.authors.includes(a);
                    } else {
                        return a === input.authors;
                    }
                }));
            }

            startTime = Date.now();
            let outputApi = await Promise.all(output.map(async o => ({
                project: await o.project.toApiV3(input.language) as ProjectApiV3,
                version: await o.version.toApiV3()
            })));
            timingString += `, map;dur=${Date.now() - startTime}`;

            if (ctx.user && ctx.user.checkRoles({ hasOneOf: [UserPermissions.Administrative_Tasks]})) {
                ctx.res.setHeader('Server-Timing', timingString);
            }

            return outputApi;
        }),
    // #endregion
    // #region getProjectAndVersions
    getProjectAndVersions: anyProcedure()
        .meta({
            openapi: {
                method: `GET`,
                path: `/v3/mods/{projectId}`,
                tags: ['Mods'],
            }
        })
        .input(z.object({
            projectId: z.number(),
            language: z.string().optional(),
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
            versions = versions
                .sort((a, b) => compare(b.semver, a.semver)) // sort versions in descending order
                .filter(async v => await v.canView(ctx.user, project));
            let outputVersions = await Promise.all(versions.map(async v => await v.toApiV3()));
            return {
                project: await project.toApiV3(input.language) as ProjectApiV3,
                versions: outputVersions
            };
        })
    // #endregion
})