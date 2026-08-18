import { GameVersion, ModApiv2Schema, ModVersionsApiv2Schema, Project, Status, User, UserPermissions, Version } from "../../../../shared/Database.ts";
import { z } from "zod/v4";
import { Op, WhereOptions, where } from "sequelize";
import { anyProcedure, router } from "../../../trpc.ts";
import { compare, Range } from "semver";
import sequelize from "sequelize/lib/sequelize";

export const getModsV2Router = router({
    getMods: anyProcedure()
        .meta({
            openapi: {
                method: 'GET',
                path: '/v2/mods',
                tags: ['Mods'],
            }
        })
        .input(z.object({
            gameName: z.string().default(`beatsaber`),
            gameVersion: z.string().optional(),
            status: z.enum([`verified`, `unverified`, `pending`, `all`]).default(`verified`),
        }))
        .output(z.object({
            mods: z.object({
                mod: ModApiv2Schema,
                latest: ModVersionsApiv2Schema
            }).array(),
        }))
        .query(async ({ input, ctx }) => {
            let timingString = ``;
            let startTime = Date.now();
            let gameVersionWhereOptions: WhereOptions<GameVersion> = {
                gameName: input.gameName.toLowerCase(), // case insensitive, due to bsmanager defaulting to BeatSaber
            };
            if (input.gameVersion) {
                gameVersionWhereOptions.version = input.gameVersion;
            }

            let allowedStatuses: Status[];
            switch (input.status) {
                case `all`:
                    allowedStatuses = [Status.Public, Status.Verified, Status.Unverified, Status.Queue, Status.Testing];
                    break;
                case `pending`:
                    allowedStatuses = [Status.Public, Status.Verified, Status.Queue, Status.Testing];
                    break;
                case Status.Unverified:
                    allowedStatuses = [Status.Public, Status.Verified, Status.Unverified];
                    break;
                case Status.Verified:
                default:
                    allowedStatuses = [Status.Public, Status.Verified];
                    break;
            }

            let versions = await Version.findAll({
                where: {
                    status: allowedStatuses,
                },
                include: [User, {
                    model: Project,
                    include: [User],
                    where: {
                        status: [Status.Public]
                    }
                }, {
                        model: GameVersion,
                        where: gameVersionWhereOptions,
                        through: { attributes: [] },
                        required: true, // inner join
                    }],
            }).then(results => {
                timingString += `db;dur=${Date.now() - startTime}`;
                startTime = Date.now();
                return results;
            });

            let output = await Promise.all(versions.sort((a, b) => compare(b.semver, a.semver)) // sort versions in descending order
                .filter((v, i, arr) => arr.findIndex(other => other.projectId === v.projectId) === i) // filter to unique projects
                .filter(async v => await v.canView(ctx.user)))
                .then(results => {
                    timingString += `, filterp1;dur=${Date.now() - startTime}`;
                    startTime = Date.now();
                    return results;
                }) // filter to versions the user can view

            let newOutput = await Promise.all(output.map(async v => ({
                mod: await (await v.project as Project).toApiV2(),
                // find all dependencies that match the current version's dependencies
                latest: await v.toApiV2(v.dependencies.map(dep => output.find(o => o.projectId === dep.pId && (new Range(dep.sv)).test(o.semver))?.id ?? 0)),
            }))
            ).then(results => results.filter(o => o.latest.dependencies.every(d => results.some(o2 => o2.latest.id === d))))
                .then(results => {
                    timingString += `, filterp2;dur=${Date.now() - startTime}`;
                    return results;
                });

            if (ctx.user && ctx.user.checkRoles({ hasOneOf: [UserPermissions.Administrative_Tasks] })) {
                ctx.res.setHeader('Server-Timing', timingString);
            }

            return { mods: newOutput };
        }),
    hashLookup: anyProcedure()
        .meta({
            openapi: {
                method: 'GET',
                path: '/v2/hashlookup',
                tags: ['Mods'],
            }
        })
        .input(z.object({
            hash: z.string().or(z.array(z.string())),
            status: z.enum(Status).optional()
        }))
        .output(z.object({
            modVersions: ModVersionsApiv2Schema.array(),
        }))
        .query(async ({ input }) => {
            let hashes = Array.isArray(input.hash) ? input.hash : [input.hash];
            let statusFilter: WhereOptions<Version> = {};
            if (input.status) {
                statusFilter.status = input.status;
            }
            // only compare against `zipHash` and the `hash` field of contentHashes
            let modVersions = await Version.findAll({
                where: {
                    ...statusFilter,
                    [Op.or]: [
                        { zipHash: { [Op.in]: hashes } },
                        sequelize.where(sequelize.fn('jsonb_exists', sequelize.col('contentHashes'), hashes), Op.eq, true)
                    ]
                },
                include: [User]
            });

            let retObjs = await Promise.all(modVersions.map(mv => mv.toApiV2([])))
            return {
                modVersions: retObjs,
            };
        }),
    multiHashLookup: anyProcedure()
        .meta({
            openapi: {
                method: 'GET',
                path: '/v2/multi/hashlookup',
                tags: ['Mods'],
            }
        })
        .input(z.object({
            hashes: z.array(z.string()),
            status: z.enum(Status).optional()
        }))
        .output(z.object({
            hashes: z.record(z.string(), ModVersionsApiv2Schema.array()),
        }))
        .query(async ({ input }) => {
            let statusFilter: WhereOptions<Version> = {};
            if (input.status) {
                statusFilter.status = input.status;
            }
            // only compare against `zipHash` and the `hash` field of contentHashes
            let modVersions = await Version.findAll({
                where: {
                    ...statusFilter,
                    [Op.or]: [
                        { zipHash: { [Op.in]: input.hashes } },
                        sequelize.where(sequelize.fn('jsonb_exists', sequelize.col('contentHashes'), input.hashes), Op.eq, true)
                    ]
                },
                include: [User]
            });

            let retObj: Record<string, Awaited<ReturnType<Version[`toApiV2`]>>[]> = {};
            await Promise.all(modVersions.map(async mv => {
                let apiObj = await mv.toApiV2([]);
                let allHashes = [mv.zipHash, ...(apiObj.contentHashes.map(ch => ch.hash))];
                for (let hash of allHashes) {
                    if (input.hashes.includes(hash)) {
                        if (!retObj[hash]) {
                            retObj[hash] = [];
                        }
                        retObj[hash].push(apiObj);
                    }
                }
            }));
            return {
                hashes: retObj,
            };
        }),
});