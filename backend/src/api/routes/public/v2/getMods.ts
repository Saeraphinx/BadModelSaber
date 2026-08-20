import { GameVersion, ModApiv2Schema, ModVersionsApiv2Schema, Project, Status, User, UserPermissions, Version } from "../../../../shared/Database.ts";
import { z } from "zod/v4";
import { Op, WhereOptions, Sequelize } from "sequelize";
import { anyProcedure, router } from "../../../trpc.ts";
import { compare, Range } from "semver";

const hashLookupSchema = z.string().trim().min(32).max(32).regex(/^[a-fA-F0-9]+$/);

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
            platform: z.enum([`universalpc`, `oculuspc`, `steampc`]).default(`universalpc`),
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
                gameName: input.gameName.toLowerCase(), // case insensitive, bsmanager defaults to BeatSaber
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

            let platforms = [`universal`];
            if (input.platform === `oculuspc`) {
                platforms.push(`oculus`);
            } else if (input.platform === `steampc`) {
                platforms.push(`steam`);
            }

            let versions = await Version.findAll({
                where: {
                    status: allowedStatuses,
                    platform: { [Op.in]: platforms },
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
                order: [['projectId', 'ASC'], ['semver', 'DESC']],
            }).then(results => {
                timingString += `db;dur=${Date.now() - startTime}`;
                startTime = Date.now();
                return results;
            });

            let output = await Promise.all(versions.sort((a, b) => {
                if (a.projectId === b.projectId) {
                    return compare(b.semver, a.semver); // sort versions in descending order
                } else {
                    return a.projectId - b.projectId; // sort by projectId in ascending order
                }
            }) // sort versions in descending order
                .filter((v, i, arr) => arr.findIndex(other => other.projectId === v.projectId) === i) // filter to unique projects
                .filter(async v => await v.canView(ctx.user)))
                .then(results => {
                    timingString += `, filterp1;dur=${Date.now() - startTime}`;
                    startTime = Date.now();
                    return results;
                }) // filter to versions the user can view

            let newOutput = await Promise.all(output.map(async v => {
                // find all dependencies that match the current version's dependencies
                let deps = v.dependencies.map(dep => output.find(o => o.projectId === dep.pId && (new Range(dep.sv)).test(o.semver))?.id ?? 0);
                return {
                    mod: await (await v.project as Project).toApiV2(),
                    latest: await v.toApiV2(deps),
                };
            })
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
            hash: z.union([hashLookupSchema, z.array(hashLookupSchema)]),
            status: z.enum(Status).optional()
        }))
        .output(z.object({
            modVersions: ModVersionsApiv2Schema.array(),
        }))
        .query(async ({ input }) => {
            let hashes = normalizeHashes(input.hash);
            let hashesSqlArray = toSqlTextArrayLiteral(hashes);
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
                        Sequelize.where(
                            Sequelize.literal(`EXISTS (SELECT 1 FROM unnest("contentHashes") AS ch WHERE ch->>'hash' = ANY(${hashesSqlArray}))`),
                            Op.eq,
                            true
                        )
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
            hashes: z.union([hashLookupSchema, z.array(hashLookupSchema)]),
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
            let hashes = normalizeHashes(input.hashes);
            let hashSet = new Set(hashes);
            let hashesSqlArray = toSqlTextArrayLiteral(hashes);
            // only compare against `zipHash` and the `hash` field of contentHashes
            let modVersions = await Version.findAll({
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
                include: [User]
            });

            let retObj: Record<string, Awaited<ReturnType<Version[`toApiV2`]>>[]> = {};
            await Promise.all(modVersions.map(async mv => {
                let apiObj = await mv.toApiV2([]);
                let allHashes = [mv.zipHash, ...(apiObj.contentHashes.map(ch => ch.hash))];
                for (let hash of allHashes) {
                    if (hashSet.has(hash.toLowerCase())) {
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

function normalizeHashes(input: string | string[]) {
    let hashes = Array.isArray(input) ? input : [input];
    return [...new Set(hashes)];
}

function toSqlTextArrayLiteral(hashes: string[]) {
    // `hashLookupSchema` constrains values to hex chars only, so quoted literals are safe here.
    return `ARRAY[${hashes.map(hash => `'${hash}'`).join(`,`)}]::text[]`;
}