import { Alert, Asset, AssetValidStatusesArray, dbId, Game, GameVersion, Project, ProjectValidStatusesArray, Status, User, UserPermissions, userPermissionsSchema, Version, VersionValidStatusesArray, WebhookLogType } from "../../../shared/Database.ts";
import { Validator } from "../../../shared/Validator.ts";
import z from "zod/v4";
import { dedupeArray, handleCatch, parseErrorMessage } from "../../../shared/Tools.ts";
import { gameProcedure, loggedInAssetProcedure, loggedInProcedure, loggedInProjectProcedure, loggedInVersionProcedure, router } from "../../trpc.ts";
import { Logger, LogLevel } from "../../../shared/Logger.ts";
import { importFromBadBeatMods, importFromOldModelSaber, importFromZip } from "../../../shared/Importer.ts";
import { TRPCError } from "@trpc/server";
import { EnvConfig } from "../../../shared/EnvConfig.ts";
import { Op } from "sequelize";
import { defaultRoles } from "./auth.ts";
import { on } from "events";
import { LogEntry } from "winston";

export const AdminRouter = router({
    user: {
        setRoles: loggedInProcedure([UserPermissions.Users_EditAllRoles])
            .input(z.object({
                userId: dbId,
                permissions: z.object({
                    sitewide: z.array(z.enum(UserPermissions)),
                    perGame: z.record(z.string(), z.array(z.enum(UserPermissions))),
                })
            }))
            .mutation(async ({ input, ctx }) => {
                let targetUser = await User.findByPk(input.userId);
                if (!targetUser) {
                    throw new TRPCError({ code: 'NOT_FOUND', message: `User not found` });
                }

                targetUser.permissions = input.permissions;
                targetUser.save().then((u) => {
                    Logger.log(`Successfully saved roles for user ${targetUser.id}: ${JSON.stringify(targetUser.permissions)}`);
                    return { message: `User roles updated successfully`, user: u };
                }).catch((e) => {
                    Logger.error(`Error saving user roles for user ${targetUser.id}: ${e}`);
                    throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR', message: `Failed to save user roles` });
                });
            }),
        banUser: loggedInProcedure([UserPermissions.Users_Ban, UserPermissions.Users_EditAllRoles])
            .input(z.object({
                userId: z.number(),
                ban: z.boolean(),
            }))
            .mutation(async ({ input, ctx }) => {
                let targetUser = await User.findByPk(input.userId);
                if (!targetUser) {
                    throw new TRPCError({ code: 'NOT_FOUND', message: `User not found` });
                }
                if (input.ban) {
                    targetUser.permissions = {
                        sitewide: dedupeArray([...targetUser.permissions.sitewide.filter(r =>
                            r !== UserPermissions.Asset_Create &&
                            r !== UserPermissions.Mods_Create &&
                            r !== UserPermissions.Users_EditSelf &&
                            r !== UserPermissions.Secret_Features
                        ), UserPermissions.C_Banned]),
                        perGame: targetUser.permissions.perGame
                    }
                } else {
                    targetUser.permissions = {
                        sitewide: dedupeArray([...targetUser.permissions.sitewide,
                        UserPermissions.Asset_Create,
                        UserPermissions.Mods_Create,
                        UserPermissions.Users_EditSelf
                        ]),
                        perGame: targetUser.permissions.perGame
                    }
                }
                targetUser.save();
            }),
        searchUsers: loggedInProcedure([UserPermissions.Users_EditAll, UserPermissions.Users_Ban, UserPermissions.Users_EditAllRoles]).input(z.object({
            query: z.string().min(1).max(16)
        })).query(async ({ input, ctx }) => {
            const users = await User.findAll({
                where: {
                    [Op.or]: {
                        displayName: {
                            [Op.iLike]: `%${input.query}%`
                        },
                        username: {
                            [Op.iLike]: `%${input.query}%`
                        },
                        discordId: {
                            [Op.iLike]: `%${input.query}%`
                        },
                        githubId: {
                            [Op.iLike]: `%${input.query}%`
                        },
                    }
                },
                limit: 10
            });
            return users.map(u => {
                return {
                    ...u.toApiV3(),
                    githubId: u.githubId,
                    discordId: u.discordId,
                };
            });
        }),
    },
    approval: {
        setStatusAsset: loggedInAssetProcedure([UserPermissions.Asset_Approval]).input(z.object({
            status: z.enum(AssetValidStatusesArray),
            reason: z.string().max(1000).optional()
        })).mutation(async ({ input, ctx }) => {
            await ctx.asset.setStatus(input.status, ctx.user, input.reason ?? `No reason given.`).then(asset => {
                return asset.toApiV3();
            }).catch(err => {
                throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR', message: `Error updating asset status: ${parseErrorMessage(err)}` });
            });
        }),
        setStatusProject: loggedInProjectProcedure([UserPermissions.Mods_Approval]).input(z.object({
            status: z.enum(ProjectValidStatusesArray),
            reason: z.string().max(1000).optional()
        })).mutation(async ({ input, ctx }) => {
            await ctx.project.setStatus(input.status, ctx.user, input.reason ?? `No reason given.`).then(project => {
                return project.toApiV3();
            }).catch(err => {
                throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR', message: `Error updating project status: ${parseErrorMessage(err)}` });
            });
        }),
        setStatusVersion: loggedInVersionProcedure([UserPermissions.Mods_Approval]).input(z.object({
            status: z.enum(VersionValidStatusesArray),
            reason: z.string().max(1000).optional(),
            autosetProject: z.boolean().default(true)
        })).mutation(async ({ input, ctx }) => {
            await ctx.version.setStatus(input.status, ctx.user, input.reason ?? `No reason given.`).then(async version => {
                if (input.autosetProject && input.status === Status.Verified && ctx.project.status !== Status.Public) {
                    await ctx.project.setStatus(Status.Public, ctx.user, `Automatically setting project verified because a version was verified.`);
                }
                return version.toApiV3();
            }).catch(err => {
                throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR', message: `Error updating version status: ${parseErrorMessage(err)}` });
            });
        }),
    },
    game: {
        createGame: loggedInProcedure([UserPermissions.Game_Create]).input(z.object({
            gameName: z.string(),
            displayName: z.string(),
        })).mutation(async ({ input }) => {
            let existingGame = await Game.findByPk(input.gameName);
            if (existingGame) {
                throw new TRPCError({ code: "CONFLICT", message: `Game with name ${input.gameName} already exists.` });
            }

            let newGame = await Game.create({
                name: input.gameName,
                displayName: input.displayName,
                default: false,
                webhookConfig: [],
            }).catch(handleCatch(`creating game`));

            return newGame.toApiV3();
        }),
        editGame: gameProcedure([UserPermissions.Game_Edit]).input(z.object({
            displayName: z.string().optional(),
            categories: z.array(z.string()).optional(),
            platforms: z.array(z.string()).optional(),
        })).mutation(async ({ ctx, input }) => {
            let game = ctx.game;

            if (input.displayName !== undefined) game.displayName = input.displayName;
            if (input.platforms !== undefined) game.platforms = input.platforms;

            if (input.categories !== undefined) {
                await game.setCategories(input.categories).catch(handleCatch(`setting game categories`));
            }

            await game.save().catch(handleCatch(`editing game`));

            return game.toApiV3();
        }),
        addWebhook: gameProcedure([UserPermissions.Game_Edit]).input(z.object({
            url: z.string(),
            types: z.array(z.enum(WebhookLogType)),
            isAssetWebhook: z.boolean().default(false),
        })).mutation(async ({ ctx, input }) => {
            let webhook = await ctx.game.addWebhook({
                url: input.url,
                types: input.types,
                isAssetWebhook: input.isAssetWebhook,
            }).catch(handleCatch(`adding webhook`));

            return ctx.game.getAPIWebhooks();
        }),
        removeWebhook: gameProcedure([UserPermissions.Game_Edit]).input(z.object({
            webhookId: z.string(),
        })).mutation(async ({ ctx, input }) => {
            await ctx.game.removeWebhook(input.webhookId).catch(handleCatch(`removing webhook`));

            return ctx.game.getAPIWebhooks();
        }),
        createGameVersion: gameProcedure([UserPermissions.Game_EditVersions]).input(z.object({
            version: z.string(),
        })).mutation(async ({ ctx, input }) => {
            let existingVersion = await GameVersion.findOne({
                where: {
                    gameName: ctx.game.name,
                    version: input.version,
                },
            });
            if (existingVersion) {
                throw new TRPCError({ code: "CONFLICT", message: `Version ${input.version} already exists for game ${ctx.game.name}.` });
            }
            let newVersion = await GameVersion.create({
                gameName: ctx.game.name,
                version: input.version,
                defaultVersion: false,
                linkedVersionIds: [],
            }).catch(handleCatch(`creating game version`));
            return newVersion.toApiV3();
        }),
        setDefaultVersion: gameProcedure([UserPermissions.Game_EditVersions]).input(z.object({
            versionId: z.number(),
        })).mutation(async ({ ctx, input }) => {
            let version = await GameVersion.findByPk(input.versionId);
            if (!version || version.gameName !== ctx.game.name) {
                throw new TRPCError({ code: "NOT_FOUND", message: `Version with id ${input.versionId} not found for game ${ctx.game.name}.` });
            }
            version.setDefault().catch(handleCatch(`setting default version`));
            return version.toApiV3();
        }),
        linkVersions: gameProcedure([UserPermissions.Game_EditVersions]).input(z.object({
            versionId1: z.number(),
            versionId2: z.number(),
        })).mutation(async ({ ctx, input }) => {
            let { gv1, gv2 } = await GameVersion.linkedVersionIdsUpdate(input.versionId1, input.versionId2).catch(handleCatch(`linking versions`));
            return {
                version1: gv1.toApiV3(),
                version2: gv2.toApiV3(),
            };
        }),
    },
    dev: {
        importOldModelSaberData: loggedInProcedure([UserPermissions.Administrative_Tasks])
            .mutation(async ({ input, ctx }) => {
                importFromOldModelSaber();
            }),
        importFromBeatmods: loggedInProcedure([UserPermissions.Administrative_Tasks])
            .mutation(async ({ input, ctx }) => {
                importFromBadBeatMods();
            }),
        importFromZip: loggedInProcedure([UserPermissions.Administrative_Tasks])
            .input(z.object({
                useUrl: z.boolean().default(false),
            }))
            .mutation(async ({ input, ctx }) => {
                importFromZip(ctx.db, input.useUrl);
            }),
        getAdminLogs: loggedInProcedure([UserPermissions.Administrative_Tasks])
            .query(async ({ input, ctx }) => {
                return Logger.getLogs(new Date(Date.now() - 1000 * 60 * 5)); // last 5 minutes
            }),
        subscribeAdminLogs: loggedInProcedure([UserPermissions.Administrative_Tasks])
            .input(z.object({
                logLevel: z.enum(LogLevel)
            }))
            .subscription(async function* (opts) {

                for await (const [data] of on(Logger.instance, 'logged', {
                    // Passing the AbortSignal from the request automatically cancels the event emitter when the request is aborted
                    signal: opts.signal,
                })) {
                    const entry = data as LogEntry;
                    yield entry;
                }
            }),
        importFakeData: loggedInProcedure([UserPermissions.Administrative_Tasks])
            .mutation(async ({ ctx }) => {
                if (!EnvConfig.isDevMode) {
                    throw new TRPCError({ code: `FORBIDDEN`, message: `Cannot import fake data in a non-development environment.` });
                }
                ctx.db.importFromFile().then(() => {
                    Logger.log(`Fake data imported by admin user ${ctx.userId}`);
                    return { message: `Fake data imported successfully` };
                }).catch((e) => {
                    Logger.error(`Error importing fake data by admin user ${ctx.userId}: ${e}`);
                    throw new TRPCError({ code: `INTERNAL_SERVER_ERROR`, message: `Failed to import fake data` });
                });
            }),
        impersonateTestUser: loggedInProcedure({ hasAllOf: [UserPermissions.Administrative_Tasks, UserPermissions.Users_EditAll] })
            .mutation(async ({ ctx }) => {
                if (!EnvConfig.isDevMode) {
                    throw new TRPCError({ code: `FORBIDDEN`, message: `Cannot impersonate test user in a non-development environment.` });
                }

                let testUser = await User.findOrCreate({
                    where: { id: 9 },
                    defaults: {
                        id: 9,
                        username: `testuser`,
                        displayName: `Test User`,
                        bio: `Test user for development purposes.`,
                        permissions: {
                            sitewide: [...defaultRoles, UserPermissions.C_System, UserPermissions.C_Developer],
                            perGame: {},
                        },
                    },
                });

                ctx.req.session.userId = testUser[0].id;
                ctx.req.session.save();
                return { message: `Impersonated test user successfully` };
            })
    }
});