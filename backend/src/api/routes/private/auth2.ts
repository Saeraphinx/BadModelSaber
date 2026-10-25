import { z } from "zod";
import { anyProcedure, Context, loggedInProcedure, notLoggedInProcedure, router } from "../../trpc.ts";
import { OAuth2API, RESTGetAPICurrentUserResult, RESTGetAPIGuildMemberResult, RESTOAuth2AuthorizationQuery, Routes } from "@discordjs/core";
import { TRPCError } from "@trpc/server";
import { REST } from "discord.js";
import { EnvConfig } from "../../../shared/EnvConfig.ts";
import { createRandomString, parseErrorMessage } from "../../../shared/Tools.ts";
import { OAuthApp } from "@octokit/oauth-app";
import { Logger } from "../../../shared/Logger.ts";
import { UserPermissions, User, defaultSitewidePermissions, defaultGamePermissions, Game, Keys } from "../../../shared/Database.ts";
import { Op, WhereOptions } from "sequelize";
import { createHash, timingSafeEqual } from "crypto";

type LoginToken = {
    platform: `discord`,
    action: 'login' | 'link',
    state: string,
    expiresAt: Date,
    user?: Awaited<ReturnType<typeof getDiscordUser>>,
} | {
    platform: `github`,
    action: 'login' | 'link',
    state: string,
    expiresAt: Date,
    user?: Awaited<ReturnType<typeof getGithubUser>>,
}

const finalizeStage: Map<string, LoginToken> = new Map();

function clearExpired() {
    const now = new Date();
    for (const [key, val] of finalizeStage) {
        if (val.expiresAt < now) finalizeStage.delete(key);
    }

    if (finalizeStage.size >= 2000) {
        // simple cleanup strategy
        for (const key of finalizeStage.keys()) {
            finalizeStage.delete(key);
            if (finalizeStage.size < 1900) break;
        }
    }
}

function prepAuth(type: `discord` | `github`, redirect?: string) {
    if (type === `discord`) {
        if (!EnvConfig.auth.discord) {
            throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR', message: `Discord authentication is not configured on this server.` });

        }
    } else if (type === `github`) {
        if (!EnvConfig.auth.github) {
            throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR', message: `GitHub authentication is not configured on this server.` });
        }
    }

    let urlProper = null;
    if (redirect) {
        urlProper = new URL(redirect);
        if (!urlProper.protocol.startsWith('http')) urlProper = new URL(EnvConfig.server.frontendUrl);
        if (urlProper.host !== new URL(EnvConfig.server.frontendUrl).host || urlProper.host !== new URL(EnvConfig.server.backendUrl).host) {
            urlProper = new URL(EnvConfig.server.frontendUrl);
        } else {
            urlProper = urlProper;
        }
    } else {
        urlProper = new URL(EnvConfig.server.frontendUrl);
    }

    const state = createRandomString(32);
    return { state, redirect: urlProper };
}

function getDiscordSetupObj(state: string, url: string): RESTOAuth2AuthorizationQuery {
    return {
        client_id: EnvConfig.auth.discord.clientId,
        redirect_uri: url,
        response_type: 'code',
        scope: 'identify guilds.members.read',
        state: state,
        prompt: 'none',
    }
}

function successfulHtmlString(redirect?: string) {
    if (!redirect) redirect = EnvConfig.server.frontendUrl;
    return `<head><meta http-equiv="refresh" content="0; url=${redirect}" /></head><body style="background-color: black;"><a style="color:white;" href="${redirect}">Click here if you are not redirected...</a></body>`;
}


export const auth2Router = router({
    logout: loggedInProcedure()
        .mutation(async ({ ctx }) => {
            return new Promise<{ message: string }>((resolve, reject) => {
                ctx.req.session.destroy((err) => {
                    if (err) {
                        Logger.error(`Error destroying session: ${parseErrorMessage(err)}`);
                        return reject(new TRPCError({ code: 'INTERNAL_SERVER_ERROR', message: `Internal server error.` }));
                    }
                    resolve({ message: `Logged out successfully.` });
                });
            });
        }),
    discord: {
        login: {
            init: notLoggedInProcedure()
                .input(z.object({
                    redirect: z.url().optional(),
                }))
                .output(z.object({
                    url: z.url(),
                }))
                .query(async ({ input, ctx, path }) => {
                    const { state, redirect } = prepAuth(`discord`, input.redirect);
                    const RESTClient = new REST({ version: '10' });
                    const oauth2 = new OAuth2API(RESTClient);
                    let url = oauth2.generateAuthorizationURL(getDiscordSetupObj(state, `${EnvConfig.server.backendUrl}/api/auth/discord/callback`));

                    ctx.req.session.oauth = { redirect: redirect.toString(), state };
                    await saveSession(ctx);

                    return { url };
                }),
            callback: notLoggedInProcedure()
                .meta({ openapi: { method: 'GET', path: '/auth/discord/callback', tags: ['Authentication'] } })
                .input(z.object({
                    code: z.string(),
                    state: z.string()
                }).partial().optional())
                .output(z.void())
                .query(async ({ ctx, input }) => {
                    if (!input || !input.code || !input.state) return;

                    const userInfo = await getDiscordUser(input.code, `${EnvConfig.server.backendUrl}/api/auth/discord/callback`).catch(e => {
                        // all errors should be TRPC errors, but just in case
                        if (e instanceof TRPCError) throw e;
                        Logger.error(`Error fetching Discord user: ${parseErrorMessage(e)}`);
                        throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR' });
                    });
                    const token = createRandomString(64);

                    clearExpired();
                    finalizeStage.set(token, {
                        platform: 'discord',
                        action: 'login',
                        state: input.state,
                        expiresAt: new Date(Date.now() + 60000),
                        user: userInfo
                    })

                    const finalizeUrl = `${EnvConfig.server.backendUrl}/api/auth/discord/final?token=${token}`;
                    Logger.info(`Discord login stage 2 completed by ${userInfo.data.id}`);
                    ctx.res.send(successfulHtmlString(finalizeUrl));
                    return;
                }),
        },
        link: {
            init: loggedInProcedure()
                .query(async ({ ctx }) => {
                    const { state, redirect } = prepAuth(`discord`);
                    const RESTClient = new REST({ version: '10' });
                    const oauth2 = new OAuth2API(RESTClient);
                    let url = oauth2.generateAuthorizationURL(getDiscordSetupObj(state, `${EnvConfig.server.backendUrl}/api/auth/discord/callback`));

                    ctx.req.session.oauth = { redirect: redirect.toString(), state, linkUserId: ctx.user.id };
                    ctx.req.session.save();

                    return { url };
                }),
            callback: notLoggedInProcedure()
                .meta({ openapi: { method: 'GET', path: '/auth/discord/link/callback', tags: ['Authentication'] } })
                .input(z.object({
                    code: z.string(),
                    state: z.string()
                }).partial().optional())
                .output(z.void())
                .query(async ({ ctx, input }) => {
                    if (!input || !input.code || !input.state) return;

                    const userInfo = await getDiscordUser(input.code, `${EnvConfig.server.backendUrl}/api/auth/discord/link/callback`).catch(e => {
                        // all errors should be TRPC errors, but just in case
                        if (e instanceof TRPCError) throw e;
                        Logger.error(`Error fetching Discord user: ${parseErrorMessage(e)}`);
                        throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR' });
                    });
                    const token = createRandomString(64);

                    clearExpired();
                    finalizeStage.set(token, {
                        platform: 'discord',
                        action: 'link',
                        state: input.state,
                        expiresAt: new Date(Date.now() + 60000),
                        user: userInfo
                    })

                    const finalizeUrl = `${EnvConfig.server.backendUrl}/api/auth/discord/final?token=${token}`;
                    Logger.info(`Discord login stage 2 completed by ${userInfo.data.id}`);
                    ctx.res.send(successfulHtmlString(finalizeUrl));
                    return;
                }),
        },
        finalize: anyProcedure()
            .meta({ openapi: { method: 'GET', path: '/auth/discord/final', tags: ['Authentication'] } })
            .input(z.object({
                token: z.string(),
            }))
            .output(z.void())
            .query(async ({ input, ctx }) => {
                if (!finalizeStage.has(input.token)) return;
                const stage = finalizeStage.get(input.token);
                if (!stage) return;
                finalizeStage.delete(input.token);
                if (stage.expiresAt < new Date() || stage.platform !== 'discord' || !stage.user) return;

                const stageUser = stage.user;
                const state = ctx.req.session.oauth?.state;
                const redirect = ctx.req.session.oauth?.redirect;
                if (!state) return;
                if (!safeEqual(state, stage.state)) return;

                if (stage.action === 'login') {
                    const gamePerms = await Game.findAll().then(games => {
                        let obj: { [key: string]: UserPermissions[] } = {};
                        for (let game of games) {
                            obj[game.name] = defaultGamePermissions;
                        }
                        return obj;
                    }).catch((err) => {
                        Logger.error(`Error fetching games from database: ${parseErrorMessage(err)}`);
                        throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR', message: `Internal server error.` });
                    });

                    const dbUser = await User.findOrCreate({
                        where: { discordId: stageUser.data.id },
                        defaults: {
                            discordId: stageUser.data.id,
                            githubId: null,
                            username: stageUser.data.username,
                            displayName: stageUser.data.global_name ?? stageUser.data.username,
                            permissions: {
                                sitewide: [...defaultSitewidePermissions, ...stageUser.roles],
                                perGame: gamePerms
                            },
                            avatarUrl: stageUser.data.avatar ? `https://cdn.discordapp.com/avatars/${stageUser.data.id}/${stageUser.data.avatar}.png` : `https://cdn.discordapp.com/embed/avatars/${Number(stageUser.data.id) % 6}.png`
                        }
                    }).then(async ([user, created]) => {
                        if (created) {
                            Logger.info(`Created new user ${user.id}`);
                        } else {
                            user.update({ avatarUrl: stageUser.data.avatar ? `https://cdn.discordapp.com/avatars/${stageUser.data.id}/${stageUser.data.avatar}.png` : `https://cdn.discordapp.com/embed/avatars/${Number(stageUser.data.id) % 6}.png` }).catch(() => Logger.error(`Failed to update ${user.id}'s avatar`));
                        }
                        return user;
                    })

                    const redirect = ctx.req.session.oauth?.redirect ?? EnvConfig.server.frontendUrl;
                    await regenerateSession(ctx);
                    ctx.req.session.userId = dbUser.id;
                    await saveSession(ctx);
                } else if (stage.action === 'link') {
                    Logger.info(`Linking Discord account for user ${ctx.req.session.userId}`);
                    const dbUser = await User.findByPk(ctx.req.session.oauth?.linkUserId);
                    if (!dbUser) throw new TRPCError({ code: 'NOT_FOUND' });
                    if (dbUser.discordId) throw new TRPCError({ code: 'CONFLICT' });
                    Logger.info(`Begin linking Discord for user ${dbUser.id}`);

                    await User.findOne({
                        where: {
                            id: { [Op.ne]: dbUser.id },
                            discordId: stageUser.data.id,
                            githubId: null
                        }
                    }).then(async exU => {
                        if (!exU) return;
                        Logger.warn(`Merging user ${exU.username} (${exU.id}) into ${dbUser.username} (${dbUser.id}) due to Discord account linking.`);

                        await exU.migrateUserItems(dbUser).then(async () => {
                            await exU.update({ discordId: null });
                            await exU.destroy();
                        }).catch((err) => {
                            Logger.error(`Error merging user ${exU.username} (${exU.id}) into ${dbUser.username} (${dbUser.id}): ${parseErrorMessage(err)}`);
                            throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR', message: `An error occurred while linking your account.` });
                        });
                    }).catch(err => {
                        Logger.error(`Error linking Discord account to user ${dbUser.id}: ${parseErrorMessage(err)}`);
                        throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR' });
                    });

                    await dbUser.update({ discordId: stageUser.data.id });
                    Logger.info(`Linked Discord ${stageUser.data.id} to user ${dbUser.id}`);
                }

                if (ctx.res) {
                    ctx.res.send(successfulHtmlString(redirect));
                }
                return;
            })
    },
    github: {
        login: {
            init: notLoggedInProcedure()
                .input(z.object({
                    redirect: z.url().optional(),
                }))
                .query(async ({ input, ctx }) => {
                    const { state, redirect } = prepAuth(`github`, input.redirect);
                    const app = new OAuthApp({
                        clientId: EnvConfig.auth.github.clientId,
                        clientSecret: EnvConfig.auth.github.clientSecret,
                    });
                    const url = app.getWebFlowAuthorizationUrl({
                        redirectUrl: `${EnvConfig.server.backendUrl}/api/auth/github/callback`,
                        state,
                        scopes: ["read:user"],
                    }).url;
                    ctx.req.session.oauth = { redirect: redirect.toString(), state };
                    ctx.req.session.save();
                    return { url }
                }),
            callback: notLoggedInProcedure()
                .meta({ openapi: { method: 'GET', path: '/auth/github/callback', tags: ['Authentication'] } })
                .input(z.object({
                    code: z.string(),
                    state: z.string()
                }).partial().optional())
                .output(z.void())
                .query(async ({ ctx, input }) => {
                    if (!input || !input.code || !input.state) return;

                    const userInfo = await getGithubUser(input.code, `${EnvConfig.server.backendUrl}/api/auth/github/callback`).catch(e => {
                        // all errors should be TRPC errors, but just in case
                        if (e instanceof TRPCError) throw e;
                        Logger.error(`Error fetching Github user: ${parseErrorMessage(e)}`);
                        throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR' });
                    });
                    const token = createRandomString(64);

                    clearExpired();
                    finalizeStage.set(token, {
                        platform: 'github',
                        action: 'login',
                        state: input.state,
                        expiresAt: new Date(Date.now() + 60000),
                        user: userInfo
                    })

                    const finalizeUrl = `${EnvConfig.server.backendUrl}/api/auth/github/final?token=${token}`;
                    Logger.info(`Github login stage 2 completed by ${userInfo.data.id}`);
                    ctx.res.send(successfulHtmlString(finalizeUrl));
                    return;
                }),
        },
        link: {
            init: loggedInProcedure()
                .query(async ({ input, ctx }) => {
                    const { state, redirect } = prepAuth(`github`);
                    const app = new OAuthApp({
                        clientId: EnvConfig.auth.github.clientId,
                        clientSecret: EnvConfig.auth.github.clientSecret,
                    });
                    const url = app.getWebFlowAuthorizationUrl({
                        redirectUrl: `${EnvConfig.server.backendUrl}/api/auth/github/link/callback`,
                        state,
                        scopes: ["read:user"],
                    }).url;
                    ctx.req.session.oauth = { redirect: redirect.toString(), state };
                    ctx.req.session.save();
                    return { url }
                }),
            callback: notLoggedInProcedure()
                .meta({ openapi: { method: 'GET', path: '/auth/github/link/callback', tags: ['Authentication'] } })
                .input(z.object({
                    code: z.string(),
                    state: z.string()
                }).partial().optional())
                .output(z.void())
                .query(async ({ ctx, input }) => {
                    if (!input || !input.code || !input.state) return;

                    const userInfo = await getGithubUser(input.code, `${EnvConfig.server.backendUrl}/api/auth/github/callback`).catch(e => {
                        // all errors should be TRPC errors, but just in case
                        if (e instanceof TRPCError) throw e;
                        Logger.error(`Error fetching Github user: ${parseErrorMessage(e)}`);
                        throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR' });
                    });
                    const token = createRandomString(64);

                    clearExpired();
                    finalizeStage.set(token, {
                        platform: 'github',
                        action: 'link',
                        state: input.state,
                        expiresAt: new Date(Date.now() + 60000),
                        user: userInfo
                    })

                    const finalizeUrl = `${EnvConfig.server.backendUrl}/api/auth/github/final?token=${token}`;
                    Logger.info(`Github login stage 2 completed by ${userInfo.data.id}`);
                    ctx.res.send(successfulHtmlString(finalizeUrl));
                    return;
                }),
        },
        finalize: anyProcedure()
            .meta({ openapi: { method: 'GET', path: '/auth/github/final', tags: ['Authentication'] } })
            .input(z.object({
                token: z.string()
            }))
            .output(z.void())
            .query(async ({ input, ctx }) => {
                if (!finalizeStage.has(input.token)) return;
                const stage = finalizeStage.get(input.token);
                if (!stage) return;
                finalizeStage.delete(input.token);
                if (stage.expiresAt < new Date() || stage.platform !== 'github' || !stage.user) return;

                const stageUser = stage.user;
                const state = ctx.req.session.oauth?.state;
                const redirect = ctx.req.session.oauth?.redirect;
                if (!state) return;
                if (!safeEqual(state, stage.state)) return;

                if (stage.action === `login`) {
                    let gamePerms = await Game.findAll().then(games => {
                        let obj: { [key: string]: UserPermissions[] } = {};
                        for (let game of games) {
                            obj[game.name] = defaultGamePermissions;
                        }
                        return obj;
                    }).catch((err) => {
                        Logger.error(`Error fetching games from database: ${parseErrorMessage(err)}`);
                        throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR', message: `Internal server error.` });
                    });

                    const dbUser = await User.findOrCreate({
                        where: { githubId: stageUser.data.id.toString() },
                        defaults: {
                            githubId: stageUser.data.id.toString(),
                            discordId: null,
                            username: stageUser.data.login,
                            displayName: stageUser.data.name ?? stageUser.data.login,
                            permissions: {
                                sitewide: [...defaultSitewidePermissions],
                                perGame: gamePerms
                            },
                            avatarUrl: stageUser.data.avatar_url
                        }
                    }).then(async ([user, created]) => {
                        if (created) {
                            Logger.info(`Created new user ${user.id}`);
                        } else {
                            user.update({ avatarUrl: stageUser.data.avatar_url }).catch(() => Logger.error(`Failed to update ${user.id}'s avatar`));
                        }
                        return user;
                    })

                    await regenerateSession(ctx);
                    ctx.req.session.userId = dbUser.id;
                    await saveSession(ctx);
                } else if (stage.action === `link`) {
                    Logger.info(`Linking GitHub account for user ${ctx.req.session.userId}`);
                    const dbUser = await User.findByPk(ctx.req.session.oauth?.linkUserId);
                    if (!dbUser) throw new TRPCError({ code: 'NOT_FOUND' });
                    if (dbUser.githubId) throw new TRPCError({ code: 'CONFLICT' });
                    Logger.info(`Begin linking Discord for user ${dbUser.id}`);

                    await User.findOne({
                        where: {
                            id: { [Op.ne]: dbUser.id },
                            githubId: stageUser.data.id.toString(),
                            discordId: null
                        }
                    }).then(async exU => {
                        if (!exU) return;
                        Logger.warn(`Merging user ${exU.username} (${exU.id}) into ${dbUser.username} (${dbUser.id}) due to GitHub account linking.`);

                        await exU.migrateUserItems(dbUser).then(async () => {
                            await exU.update({ discordId: null });
                            await exU.destroy();
                        }).catch((err) => {
                            Logger.error(`Error merging user ${exU.username} (${exU.id}) into ${dbUser.username} (${dbUser.id}): ${parseErrorMessage(err)}`);
                            throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR', message: `An error occurred while linking your account.` });
                        });
                    }).catch(err => {
                        Logger.error(`Error linking GitHub account to user ${dbUser.id}: ${parseErrorMessage(err)}`);
                        throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR' });
                    });

                    await dbUser.update({ githubId: stageUser.data.id.toString() });
                    Logger.info(`Linked GitHub ${stageUser.data.id} to user ${dbUser.id}`);
                }

                if (ctx.res) {
                    ctx.res.send(successfulHtmlString(redirect));
                }
                return;
            })
    },
    generateApiKey: loggedInProcedure()
        .input(z.object({
            name: z.string().min(1).max(64),
        }))
        .mutation(async ({ ctx, input }) => {
            if (ctx.isApiKey) {
                throw new TRPCError({ code: 'FORBIDDEN', message: `API keys cannot generate new API keys.` });
            }

            if (!EnvConfig.server.enableApiKeys) {
                throw new TRPCError({ code: 'FORBIDDEN', message: `API keys are disabled.` });
            }

            const { key, hash } = Keys.generateKey(ctx.user.id);

            await Keys.create({
                key: hash,
                userId: ctx.user.id,
                name: input.name,
            }).then(() => {
                Logger.info(`User ${ctx.user.username} (${ctx.user.id}) generated a new API key.`);
            });

            return { key: key, name: input.name }
        }),
    listApiKeys: loggedInProcedure()
        .query(async ({ ctx }) => {
            if (!EnvConfig.server.enableApiKeys) {
                throw new TRPCError({ code: 'FORBIDDEN', message: `API keys are disabled.` });
            }

            const keys = await Keys.findAll({
                where: { userId: ctx.user.id },
                attributes: ['name', 'createdAt', 'updatedAt'],
            });

            return keys.map((key) => ({
                name: key.name,
                createdAt: key.createdAt,
                updatedAt: key.updatedAt,
            }));
        }),
    revokeApiKey: loggedInProcedure()
        .input(z.object({
            name: z.string().min(1).max(64).optional(),
            key: z.string().max(128).optional(),
        }))
        .mutation(async ({ ctx, input }) => {
            let whereOptions: WhereOptions<Keys> = { userId: ctx.user.id };
            if (input.name) {
                whereOptions.name = input.name;
            } else if (input.key) {
                let key = input.key.split('.')[2];
                if (!key || key.length !== 43) {
                    throw new TRPCError({ code: 'BAD_REQUEST', message: `Invalid API key format.` });
                }

                const hash = createHash('sha256').update(key).digest(`base64url`);
                whereOptions.key = hash;
            }

            await Keys.destroy({
                where: whereOptions
            }).then((count) => {
                if (count === 0) {
                    throw new TRPCError({ code: 'NOT_FOUND', message: `API key not found.` });
                } else {
                    Logger.info(`User ${ctx.user.username} (${ctx.user.id}) revoked ${count} API key(s).`);
                }
            });
        }),
});

async function regenerateSession(ctx: Context) {
    await new Promise<void>((res, rej) => ctx.req.session.regenerate(e => e ? rej(e) : res()));
}

async function saveSession(ctx: Context) {
    await new Promise<void>((res, rej) => ctx.req.session.save(e => e ? rej(e) : res()));
}


function safeEqual(a: string, b: string) {
    const x = Buffer.from(a), y = Buffer.from(b);
    return x.length === y.length && timingSafeEqual(x, y);
}

async function getDiscordUser(code: string, redirect: string): Promise<{ data: RESTGetAPICurrentUserResult, roles: UserPermissions[] }> {
    const RESTClient = new REST({ version: '10' });
    const oauth2 = new OAuth2API(RESTClient);
    let token = await oauth2.tokenExchange({
        code,
        grant_type: 'authorization_code',
        client_id: EnvConfig.auth.discord.clientId,
        client_secret: EnvConfig.auth.discord.clientSecret,
        redirect_uri: redirect,
    }).catch(e => {
        Logger.error(`Error exchanging discord token: ${parseErrorMessage(e)}`);
        throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR' })
    });

    RESTClient.setToken(token.access_token);

    // discord doesn't type this route for some reason
    let user = await RESTClient.get(Routes.user(`@me`), { authPrefix: `Bearer` }).then(r => r as RESTGetAPICurrentUserResult).catch(e => {
        Logger.error(`Error fetching discord user: ${parseErrorMessage(e)}`);
        throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR' })
    });

    if (!user) throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR' });

    let bsmgInfo = await RESTClient.get(Routes.userGuildMember(`441805394323439646`), { authPrefix: `Bearer` }).then(res => res as RESTGetAPIGuildMemberResult).catch((err) => {
        Logger.error(`Error fetching BSMG guild member info: ${parseErrorMessage(err)}`);
        return null;
    });

    await oauth2.revokeToken(EnvConfig.auth.discord.clientId, EnvConfig.auth.discord.clientSecret, { token: token.access_token }).catch(e => {
        Logger.error(`Error revoking discord token: ${parseErrorMessage(e)}`);
    });

    let rolesToAdd: UserPermissions[] = []
    if (bsmgInfo) {
        if (bsmgInfo.roles.includes(`441806759062011905`)) rolesToAdd.push(UserPermissions.C_Modder);
        if (bsmgInfo.roles.includes(`457373773499203590`)) rolesToAdd.push(UserPermissions.C_Modeler);
        if (bsmgInfo.roles.includes(`466449484759564309`)) rolesToAdd.push(UserPermissions.C_BSMG_Staff);
    }

    return { data: user, roles: rolesToAdd };
}

async function getGithubUser(code: string, redirect: string) {
    const app = new OAuthApp({
        clientId: EnvConfig.auth.github.clientId,
        clientSecret: EnvConfig.auth.github.clientSecret,
    });

    let tokenResponse = await app.createToken({
        code: code,
        state: redirect,
    }).catch((err) => {
        Logger.error(`Error exchanging GitHub code for token: ${parseErrorMessage(err)}`);
        throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR', message: `Error contacting GitHub.` });
    })

    let githubUser = await app.checkToken({
        token: tokenResponse.authentication.token,
    }).then(res => {
        if (!res.data.user) {
            throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR', message: `Failed to fetch user info from GitHub.` });
        } else {
            return res.data.user;
        }
    }).catch((err) => {
        Logger.error(`Error fetching GitHub user info: ${parseErrorMessage(err)}`);
        throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR', message: `Failed to fetch user info from GitHub.` });
    });

    return { data: githubUser };
}