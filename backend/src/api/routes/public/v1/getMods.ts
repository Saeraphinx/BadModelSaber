import { GameVersion, ModApiV1, ModApiv2Schema, ModVersionsApiv2Schema, Project, Status, User, Version } from "../../../../shared/Database.ts";
import { z } from "zod/v4";
import { anyProcedure, router } from "../../../trpc.ts";
import { coerce, compare } from "semver";
import { Op, WhereOptions } from "sequelize";

export const getModsV1Router = router({
    getVersions: anyProcedure()
        .meta({
            openapi: {
                method: 'GET',
                path: '/versions.json',
                tags: ['Mods'],
                deprecated: true,
            }
        })
        .input(z.void())
        .output(z.array(z.string()))
        .query(async ({ input, ctx }) => {
            let versions = await GameVersion.findAll({
                where: {
                    gameName: 'beatsaber',
                },
                attributes: ['version']
            }).then(gvs => gvs.map(gv => gv.version));

            versions.sort((a, b) => {
                let verA = coerce(a, { loose: true });
                let verB = coerce(b, { loose: true });
                if (verA && verB) {
                    return verB.compare(verA); // this is reversed so that the latest version is first in the array
                } else {
                    return b.localeCompare(a);
                }
            });

            return versions;
        }),
    getAliases: anyProcedure()
        .meta({
            openapi: {
                method: 'GET',
                path: '/aliases.json',
                tags: ['Mods'],
                deprecated: true,
            }
        })
        .input(z.void())
        .output(z.record(z.string(), z.array(z.string())))
        .query(async ({ input, ctx }) => {
            let aliases: any = {};
            let versions = await GameVersion.findAll({
                where: {
                    gameName: 'beatsaber',
                },
                attributes: ['version']
            }).then(gvs => gvs.map(gv => gv.version));
            for (let version of versions) {
                aliases[version] = [];
            }
            return aliases;
        }),
    getMods: anyProcedure()
        .meta({
            openapi: {
                method: 'GET',
                path: '/v1/mods',
                tags: ['Mods'],
                deprecated: true,
            }
        })
        .input(z.object({
            gameVersion: z.string().optional(),
            status: z.string().optional()
        }))
        .output(z.array(z.any()))
        .query(async ({ input, ctx }) => {
            let showUnverified = input.status !== `approved`
            let gameVersionWhereOptions: WhereOptions<GameVersion> = {
                gameName: 'beatsaber',
            };

            if (input.gameVersion) {
                gameVersionWhereOptions.version = input.gameVersion;
            }

            let versions = await Version.findAll({
                where: {
                    status: showUnverified ? [Status.Verified, Status.Unverified, Status.Pending] : [Status.Verified],
                },
                include: [Project, User, {
                    model: GameVersion,
                    where: gameVersionWhereOptions,
                    through: { attributes: [] },
                    required: true,
                }],
            });

            let output = await Promise.all(versions.sort((a, b) => compare(b.semver, a.semver)) // sort versions in descending order
                .filter((v, i, arr) => arr.findIndex(other => other.projectId === v.projectId) === i) // filter to unique projects
                .filter(async v => await v.canView(ctx.user)) // filter to versions the user can view
            );

            let apiOutput: Promise<ModApiV1>[] = [];
            for (let ver of output) {
                let project = await ver.project as Project;
                apiOutput.push(ver.toApiV1(project, ver.supportedGameVersions[0], true));
            }
            return await Promise.allSettled(apiOutput).then(results => {
                let fulfilledResults = results.filter(r => r.status === 'fulfilled') as PromiseFulfilledResult<ModApiV1>[];
                return fulfilledResults.map(r => r.value);
            });
        })
})