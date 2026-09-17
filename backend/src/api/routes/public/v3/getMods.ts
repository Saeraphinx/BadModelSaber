import { Logger } from "../../../../shared/Logger.ts";
import { availableBackendLocaleCodes, GameVersion, GameVersionWhereOptions, Project, ProjectApiV3, projectApiV3Schema, ProjectWhereOptions, Status, User, UserPermissions, Version, VersionApiV3, versionApiV3Schema } from "../../../../shared/Database.ts";
import { anyGameProcedure, anyProcedure, gameProcedure, router } from "../../../trpc.ts";
import z from "zod/v4";
import { TRPCError } from "@trpc/server";
import { Op, WhereOptions } from "sequelize";
import { compare } from "semver";
import { Sequelize } from "sequelize-typescript";
import { addCacheHeaders, addTimingHeaders } from "../../../../shared/Tools.ts";
import { QueryCache } from "../../../../shared/Cache.ts";

const hashLookupSchema = z.string().trim().min(32).max(32).regex(/^[a-fA-F0-9]+$/);

export const GetModsV3 = router({
    // #region getMods
    getMods: anyGameProcedure()
        .meta({
            openapi: {
                method: `GET`,
                path: `/v3/mods`,
                tags: ['Mods'],
                summary: 'Get a list of mods with filtering options',
            }
        })
        .input(z.object({
            gameVersion: z.string().min(1).max(100).optional(),
            status: z.array(z.enum(Status)).max(Object.values(Status).length).optional().default([Status.Verified, Status.Unverified]),
            name: z.string().min(1).max(100).optional(),
            authors: z.array(z.int()).min(1).max(20).optional(),
            platform: z.string().min(1).max(100).optional(),
            language: z.enum(availableBackendLocaleCodes).optional(),
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

            if (availableGameVerison.length === 0) {
                throw new TRPCError({ code: 'NOT_FOUND', message: 'No game versions found for the specified game and version.' });
            }

            let projectFilters: WhereOptions<Project> = {};
            let userFilters: WhereOptions<User> = {};
            let versionFilters: WhereOptions<Version> = {};
            if (input.name) {
                projectFilters = {
                    name: {
                        [Op.iLike]: `%${input.name}%`
                    }
                }
            }

            if (input.authors && input.authors.length > 0) {
                userFilters = {
                    id: {
                        [Op.in]: input.authors,
                    }
                };
            }

            if (input.status && input.status.length > 0) {
                if (input.status.every(s => User.getAllowedStatuses(ctx.user, 'mod', input.gameName).includes(s))) {
                    versionFilters = {
                        status: {
                            [Op.in]: input.status,
                        },
                    };
                } else {
                    throw new TRPCError({ code: 'FORBIDDEN', message: 'You do not have permission to view mods with the specified status.' });
                }
            }
            timingString = `start;dur=${Date.now() - startTime}`;
            startTime = Date.now();

            const alreadyCached = QueryCache.modV3Cache.get(JSON.stringify(input));
            if (alreadyCached) {
                timingString += `, cache;dur=${Date.now() - startTime}`
                addTimingHeaders(ctx, timingString);
                addCacheHeaders(ctx);
                return alreadyCached;
            }
            
            let versions = await Version.findAll({
                where: versionFilters,
                order: [['projectId', 'DESC']],
                include: [{
                    model: Project,
                    include: [{
                        model: User,
                        where: userFilters,
                    }],
                    where: {
                        ...projectFilters,
                        status: {
                            [Op.in]: User.getAllowedStatuses(ctx.user, 'mod'),
                        }
                    },
                }, {
                    model: GameVersion,
                    where: {
                        id: availableGameVerison
                    },
                }],
            }).then(v => {
                timingString += `, db;dur=${Date.now() - startTime}`;
                startTime = Date.now();
                return v;
            });

            // filter to unique projects and versions that the user can view
            let filter1Start = Date.now();
            let output = await Promise.all(versions
                .sort((a, b) => compare(b.semver, a.semver)) // sort versions in descending order
                .filter((v, i, arr) => arr.findIndex(other => other.projectId === v.projectId) === i) // filter to unique projects
                .filter(async v => await v.canView(ctx.user)) // filter to versions the user can view
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
            let outputApi = await Promise.all(output.map(async o => ({
                project: await o.project.toApiV3(input.language) as ProjectApiV3,
                version: await o.version.toApiV3()
            })));
            timingString += `, map;dur=${Date.now() - startTime}`;

            addTimingHeaders(ctx, timingString);
            addCacheHeaders(ctx);
            QueryCache.modV3Cache.set(JSON.stringify(input), outputApi);
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
                summary: 'Get a project and all of its versions',
            }
        })
        .input(z.object({
            projectId: z.number(),
            language: z.enum(availableBackendLocaleCodes).optional(),
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
            if (!(await project.canView(ctx.user))) {
                throw new TRPCError({ code: 'FORBIDDEN', message: 'You do not have permission to view this project.' });
            }
            let versions = await Version.findAll({
                where: {
                    projectId: project.id,
                    status: User.getAllowedStatuses(ctx.user, `mod`, project.gameName)
                },
                order: [['semver', 'DESC']],
                include: [GameVersion, Project],
            });
            versions = versions
                .sort((a, b) => compare(b.semver, a.semver)) // sort versions in descending order
                .filter(async v => await v.canView(ctx.user, project));
            let outputVersions = await Promise.all(versions.map(async v => await v.toApiV3()));
            addCacheHeaders(ctx);
            return {
                project: await project.toApiV3(input.language) as ProjectApiV3,
                versions: outputVersions
            };
        }),
    // #endregion
    getVersionByHash: anyProcedure()
        .meta({
            openapi: {
                method: `GET`,
                path: `/v3/hashlookup/version`,
                tags: ['Mods'],
                summary: 'Get a version by its hash',
            }
        })
        .input(z.object({
            hash: z.union([hashLookupSchema, z.array(hashLookupSchema)]),
            status: z.enum(Status).optional()
        }))
        .output(z.record(z.string(), z.object({
            project: projectApiV3Schema,
            version: versionApiV3Schema
        })))
        .query(async ({ ctx, input }) => {
            let hashes = normalizeHashes(input.hash);
            let hashesSqlArray = toSqlTextArrayLiteral(hashes);
            let statusFilter: WhereOptions<Version> = {};
            if (input.status) {
                statusFilter.status = input.status;
            }
            // only compare against `zipHash` and the `hash` field of contentHashes
            let versions = await Version.findAll({
                where: {
                    ...statusFilter,
                    [Op.or]: [
                        { zipHash: { [Op.in]: hashes } },
                        Sequelize.where(
                            Sequelize.literal(`EXISTS (SELECT 1 FROM unnest("contentHashes") AS ch WHERE ch->>'hash' = ANY(${hashesSqlArray}))`),
                            Op.eq,
                            true
                        )
                    ]
                },
                include: [GameVersion, Project]
            });
            if (versions.length === 0) {
                throw new TRPCError({ code: 'NOT_FOUND', message: 'Version not found.' });
            }
            let output: Record<string, { project: ProjectApiV3, version: VersionApiV3 }> = {};
            for (let v of versions) {
                let p = await v.project;
                if (!p) continue;
                output[v.zipHash] = {
                    project: await p.toApiV3(),
                    version: await v.toApiV3()
                };
            }
            addCacheHeaders(ctx);
            return output;
            
        })
})

function normalizeHashes(input: string | string[]) {
    let hashes = Array.isArray(input) ? input : [input];
    return [...new Set(hashes)];
}

function toSqlTextArrayLiteral(hashes: string[]) {
    // `hashLookupSchema` constrains values to hex chars only, so quoted literals are safe here.
    return `ARRAY[${hashes.map(hash => `'${hash}'`).join(`,`)}]::text[]`;
}