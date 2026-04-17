import { Logger } from '../../../shared/Logger.ts';
import { Validator } from '../../../shared/Validator.ts';
import { createRandomString, parseErrorMessage } from '../../../shared/Tools.ts';
import { EnvConfig } from '../../../shared/EnvConfig.ts';
import { User, UserPermissions } from '../../../shared/Database.ts';
import { anyProcedure, loggedInProcedure, notLoggedInProcedure, publicProcedure, router } from '../../trpc.ts';
import { REST, RESTGetAPICurrentUserGuildsQuery, RESTGetAPICurrentUserGuildsResult, RESTGetAPICurrentUserResult, RESTGetAPIGuildMemberResult, RESTOAuth2AuthorizationQuery, RESTPostOAuth2AccessTokenWithBotAndGuildsScopeResult, RESTPostOAuth2ClientCredentialsResult, Routes } from 'discord.js';
import { OAuth2API } from '@discordjs/core';
import z from 'zod/v4';
import { TRPCError } from '@trpc/server';
import { OAuthApp } from "@octokit/oauth-app";
import { Op } from 'sequelize';

export function loadAuthConfig() {
    if (!EnvConfig.auth.discord.clientSecret || !EnvConfig.auth.discord.clientId) {
        Logger.warn(`Discord authentication is not configured.`);
        return;
    }
}

let validStates: { stateId: string, ip: string, redirectUrl: URL, userId: number | null }[] = [];

function prepAuth(ip: string, redirectUrl: string, userId?: number, minsToTimeout = 5): string | null {
    let state = createRandomString(32);
    if (userId) {
        validStates.push({ stateId: state, ip: ip, redirectUrl: new URL(redirectUrl), userId });
    } else {
        validStates.push({ stateId: state, ip: ip, redirectUrl: new URL(redirectUrl), userId: null });
    }
    setTimeout(() => {
        validStates = validStates.filter((s) => s.stateId !== state);
    }, 1000 * 60 * minsToTimeout);
    return state;
}

export const authRouter = router({
    // #region Discord Login
    discordAuthInit: notLoggedInProcedure()
        .input(z.object({
            redirect: z.url().optional(),
        }))
        .output(z.object({
            url: z.url(),
        }))
        .query(async ({ input, ctx, path }) => {
            if (!EnvConfig.auth.discord) {
                throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR', message: `Discord authentication is not configured on this server.` });
            }

            let state = prepAuth(ctx.req.ip || ``, input.redirect ?? EnvConfig.server.frontendUrl);
            if (!state) {
                throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR', message: `Could not prepare authentication.` });
            }

            let RESTClient = new REST({ version: '10' });
            let oauth2 = new OAuth2API(RESTClient);
            let url = oauth2.generateAuthorizationURL({
                client_id: EnvConfig.auth.discord.clientId,
                redirect_uri: `${EnvConfig.server.backendUrl}/api/auth/discord/callback`,
                response_type: 'code',
                scope: 'identify guilds.members.read',
                state: state,
                prompt: 'none',
            })

            return { url };
        }),
    discordAuthCallback: notLoggedInProcedure()
        .meta({ openapi: { method: 'GET', path: '/auth/discord/callback', tags: ['Authentication'] } })
        .input(z.object({
            code: z.string(),
            state: z.string(),
        }))
        .output(z.void())
        .query(async ({ input, ctx }) => {
            let stateObj = validStates.find((s) => s.stateId === input.state && s.ip === ctx.req.ip);
            if (!stateObj) {
                throw new TRPCError({ code: 'BAD_REQUEST', message: `Invalid state.` });
            }
            validStates = validStates.filter((s) => s.stateId !== input.state);

            let RESTClient = new REST({ version: '10' });
            let tokenResponse = await (new OAuth2API(RESTClient)).tokenExchange({
                code: input.code,
                grant_type: 'authorization_code',
                client_id: EnvConfig.auth.discord.clientId,
                client_secret: EnvConfig.auth.discord.clientSecret,
                redirect_uri: `${EnvConfig.server.backendUrl}/api/auth/discord/callback`,
            });
            RESTClient.setToken(tokenResponse.access_token);
            let userInfo = await RESTClient.get(Routes.user(`@me`), { authPrefix: `Bearer` }).then((res) => res as RESTGetAPICurrentUserResult).catch((err) => {
                Logger.error(`Error fetching Discord user info: ${parseErrorMessage(err)}`);
                throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR', message: `Failed to fetch user info from Discord.` });
            });

            let bsmgInfo = await RESTClient.get(Routes.userGuildMember(`441805394323439646`), { authPrefix: `Bearer` }).then(res => res as RESTGetAPIGuildMemberResult).catch((err) => {
                Logger.error(`Error fetching BSMG guild member info: ${parseErrorMessage(err)}`);
                return null;
            });

            let dbUser = await User.findOne({ where: { discordId: userInfo.id } });
            if (!dbUser) {
                let roles = {
                    sitewide: [UserPermissions.Asset_Create, UserPermissions.Mods_Create, UserPermissions.Users_EditSelf],
                    perGame: {},
                };
                if (userInfo && EnvConfig.auth.discord.autoAdminIds && EnvConfig.auth.discord.autoAdminIds.includes(userInfo.id)) {
                    Logger.info(`Auto-assigning administrative permissions to user ${userInfo.username} (${userInfo.id})`);
                    roles.sitewide.push(UserPermissions.C_Admin);
                    roles.sitewide.push(UserPermissions.Administrative_Tasks);
                    roles.sitewide.push(UserPermissions.Users_EditAllRoles);
                }
                if (userInfo && userInfo.id === `213074932458979330`) {
                    Logger.info(`Assigning special permissions to user ${userInfo.username} (${userInfo.id})`);
                    roles.sitewide.push(UserPermissions.C_Developer);
                }
                if (bsmgInfo) {
                    if (bsmgInfo.roles.includes(`441806759062011905`)) roles.sitewide.push(UserPermissions.C_Modder);
                    if (bsmgInfo.roles.includes(`457373773499203590`)) roles.sitewide.push(UserPermissions.C_Modeler);
                    if (bsmgInfo.roles.includes(`466449484759564309`)) roles.sitewide.push(UserPermissions.C_BSMG_Staff);
                }

                dbUser = await User.create({
                    discordId: userInfo.id,
                    githubId: null,
                    username: userInfo.username,
                    displayName: userInfo.global_name ?? userInfo.username,
                    permissions: roles,
                    avatarUrl: userInfo.avatar ? `https://cdn.discordapp.com/avatars/${userInfo.id}/${userInfo.avatar}.png` : `https://cdn.discordapp.com/embed/avatars/${Number(userInfo.id) % 6}.png`,
                });
                Logger.info(`New user created: ${dbUser.username} (${dbUser.id})`);
            } else {
                await dbUser.update({
                    username: userInfo.username,
                    displayName: userInfo.global_name || userInfo.username,
                    avatarUrl: userInfo.avatar ? `https://cdn.discordapp.com/avatars/${userInfo.id}/${userInfo.avatar}.png` : `https://cdn.discordapp.com/embed/avatars/${Number(userInfo.id) % 6}.png`,
                });
            }

            ctx.req.session.userId = dbUser.id;
            ctx.req.session.save((err) => {
                if (err) {
                    Logger.error(`Error saving session: ${parseErrorMessage(err)}`);
                    throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR', message: `Internal server error.` });
                }
            });
            if (ctx.res) {
                ctx.res.send(`<head><meta http-equiv="refresh" content="0; url=${stateObj.redirectUrl.href}" /></head><body style="background-color: black;"><a style="color:white;" href="${stateObj.redirectUrl.href}">Click here if you are not redirected...</a></body>`);
            }
            return;
        }),
    // #endregion
    // #region GitHub Login
    githubAuthInit: notLoggedInProcedure()
        .input(z.object({
            redirect: z.url().optional(),
        }))
        .output(z.object({
            url: z.url(),
        }))
        .query(async ({ input, ctx }) => {
            let state = prepAuth(ctx.req.ip || ``, input.redirect ?? EnvConfig.server.frontendUrl);
            if (!state) {
                throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR', message: `Could not prepare authentication.` });
            }


            const app = new OAuthApp({
                clientId: EnvConfig.auth.github.clientId,
                clientSecret: EnvConfig.auth.github.clientSecret,
            });

            const url = app.getWebFlowAuthorizationUrl({
                redirectUrl: `${EnvConfig.server.backendUrl}/api/auth/github/callback`,
                state: state,
                scopes: ["read:user"],
            }).url;

            return { url };

        }),
    githubAuthCallback: notLoggedInProcedure()
        .meta({ openapi: { method: 'GET', path: '/auth/github/callback', tags: ['Authentication'] } })
        .input(z.object({
            code: z.string(),
            state: z.string(),
        }))
        .output(z.void())
        .query(async ({ input, ctx }) => {
            if (!EnvConfig.auth.github) {
                throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR', message: `GitHub authentication is not configured on this server.` });
            }

            let stateObj = validStates.find((s) => s.stateId === input.state && s.ip === ctx.req.ip);
            if (!stateObj) {
                throw new TRPCError({ code: 'BAD_REQUEST', message: `Invalid state.` });
            }
            validStates = validStates.filter((s) => s.stateId !== input.state);

            const app = new OAuthApp({
                clientId: EnvConfig.auth.github.clientId,
                clientSecret: EnvConfig.auth.github.clientSecret,
            });

            let tokenResponse = await app.createToken({
                code: input.code,
                state: input.state,
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

            let dbUser = await User.findOne({ where: { githubId: githubUser.id } });
            if (!dbUser) {
                let roles = {
                    sitewide: [UserPermissions.Asset_Create, UserPermissions.Mods_Create, UserPermissions.Users_EditSelf],
                    perGame: {},
                };
                if (githubUser && EnvConfig.auth.github.autoAdminIds && EnvConfig.auth.github.autoAdminIds.includes(githubUser.id.toString())) {
                    Logger.info(`Auto-assigning administrative permissions to user ${githubUser.login} (${githubUser.id})`);
                    roles.sitewide.push(UserPermissions.C_Admin);
                    roles.sitewide.push(UserPermissions.Administrative_Tasks);
                    roles.sitewide.push(UserPermissions.Users_EditAllRoles);
                }

                dbUser = await User.create({
                    discordId: null,
                    githubId: githubUser.id.toString(),
                    username: githubUser.login,
                    displayName: githubUser.name || githubUser.login,
                    permissions: roles,
                    avatarUrl: githubUser.avatar_url,
                });
                Logger.info(`New user created: ${dbUser.username} (${dbUser.id})`);
            } else {
                await dbUser.update({
                    username: githubUser.login,
                    displayName: githubUser.name || githubUser.login,
                    avatarUrl: githubUser.avatar_url,
                });
            }

            ctx.req.session.userId = dbUser.id;
            ctx.req.session.save((err) => {
                if (err) {
                    Logger.error(`Error saving session: ${parseErrorMessage(err)}`);
                    throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR', message: `Internal server error.` });
                }
            });
            if (ctx.res) {
                ctx.res.send(`<head><meta http-equiv="refresh" content="0; url=${stateObj.redirectUrl.href}" /></head><body style="background-color: black;"><a style="color:white;" href="${stateObj.redirectUrl.href}">Click here if you are not redirected...</a></body>`);
            }
            return;
        }),
    // #endregion
    // #region GitHub -> Discord Account Linking
    linkGitHubToaccount: loggedInProcedure()
        .input(z.object({
            redirect: z.url().optional(),
        }))
        .output(z.object({
            url: z.url(),
        }))
        .query(async ({ input, ctx }) => {
            if (!EnvConfig.auth.github) {
                throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR', message: `GitHub authentication is not configured on this server.` });
            }

            let state = prepAuth(ctx.req.ip || ``, input.redirect ?? EnvConfig.server.frontendUrl, ctx.userId);
            if (!state) {
                throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR', message: `Could not prepare authentication.` });
            }

            const app = new OAuthApp({
                clientId: EnvConfig.auth.github.clientId,
                clientSecret: EnvConfig.auth.github.clientSecret,
            });

            const url = app.getWebFlowAuthorizationUrl({
                redirectUrl: `${EnvConfig.server.backendUrl}/api/auth/github/link/callback`,
                state: state,
                scopes: ["read:user"],
            }).url;

            return { url };
        }),
    linkGitHubToAccountCallback: loggedInProcedure()
        .meta({ openapi: { method: 'GET', path: '/auth/github/link/callback', tags: ['Authentication'] } })
        .input(z.object({
            code: z.string(),
            state: z.string(),
        }))
        .output(z.void())
        .query(async ({ input, ctx }) => {
            let stateObj = validStates.find((s) => s.stateId === input.state && s.ip === ctx.req.ip && s.userId === ctx.userId);
            if (!stateObj) {
                throw new TRPCError({ code: 'BAD_REQUEST', message: `Invalid state.` });
            }
            validStates = validStates.filter((s) => s.stateId !== input.state);

            const app = new OAuthApp({
                clientId: EnvConfig.auth.github.clientId,
                clientSecret: EnvConfig.auth.github.clientSecret,
            });

            let tokenResponse = await app.createToken({
                code: input.code,
                state: input.state,
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

            const dbUser = ctx.user;

            if (dbUser.githubId && dbUser.githubId !== githubUser.id.toString()) {
                throw new TRPCError({ code: 'CONFLICT', message: `Your account is already linked to a different GitHub account.` });
            }

            let existingUserWithGitHub = await User.findOne({ where: { 
                id: { [Op.ne]: dbUser.id },
                githubId: githubUser.id.toString(), 
                discordId: {[Op.ne]: null }
            } });

            if (existingUserWithGitHub) {
                Logger.info(`Merging user ${existingUserWithGitHub.username} (${existingUserWithGitHub.id}) into ${dbUser.username} (${dbUser.id}) due to GitHub account linking.`);

                await existingUserWithGitHub.migrateUserItems(dbUser).then(() => {
                    existingUserWithGitHub.destroy();
                }).catch((err) => {
                    Logger.error(`Error merging user ${existingUserWithGitHub.username} (${existingUserWithGitHub.id}) into ${dbUser.username} (${dbUser.id}): ${parseErrorMessage(err)}`);
                });
            }

            await dbUser.update({
                githubId: githubUser.id.toString(),
            });
            

            if (ctx.res) {
                ctx.res.send(`<head><meta http-equiv="refresh" content="0; url=${stateObj.redirectUrl.href}" /></head><body style="background-color: black;"><a style="color:white;" href="${stateObj.redirectUrl.href}">Click here if you are not redirected...</a></body>`);
            }
            return;
        }),
        // #endregion
    // #region Discord -> GitHub Account Linking
    linkDiscordToAccount: loggedInProcedure()
        .input(z.object({
            redirect: z.url().optional(),
        }))
        .output(z.object({
            url: z.url(),
        }))
        .query(async ({ input, ctx }) => {
            if (!EnvConfig.auth.discord) {
                throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR', message: `Discord authentication is not configured on this server.` });
            }

            let state = prepAuth(ctx.req.ip || ``, input.redirect ?? EnvConfig.server.frontendUrl, ctx.userId);
            if (!state) {
                throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR', message: `Could not prepare authentication.` });
            }

            let RESTClient = new REST({ version: '10' });
            let oauth2 = new OAuth2API(RESTClient);
            let url = oauth2.generateAuthorizationURL({
                client_id: EnvConfig.auth.discord.clientId,
                redirect_uri: `${EnvConfig.server.backendUrl}/api/auth/discord/link/callback`,
                response_type: 'code',
                scope: 'identify guilds.members.read',
                state: state,
                prompt: 'none',
            })

            return { url };
        }),
    linkDiscordToAccountCallback: loggedInProcedure()
        .meta({ openapi: { method: 'GET', path: '/auth/discord/link/callback', tags: ['Authentication'] } })
        .input(z.object({
            code: z.string(),
            state: z.string(),
        }))
        .output(z.void())
        .query(async ({ input, ctx }) => {
            let stateObj = validStates.find((s) => s.stateId === input.state && s.ip === ctx.req.ip && s.userId === ctx.userId);
            if (!stateObj) {
                throw new TRPCError({ code: 'BAD_REQUEST', message: `Invalid state.` });
            }
            validStates = validStates.filter((s) => s.stateId !== input.state);

            let RESTClient = new REST({ version: '10' });
            let oauth2 = new OAuth2API(RESTClient);
            let tokenResponse = await oauth2.tokenExchange({
                code: input.code,
                grant_type: 'authorization_code',
                client_id: EnvConfig.auth.discord.clientId,
                client_secret: EnvConfig.auth.discord.clientSecret,
                redirect_uri: `${EnvConfig.server.backendUrl}/api/auth/discord/link/callback`,
            });
            RESTClient.setToken(tokenResponse.access_token);
            let userInfo = await RESTClient.get(Routes.user(`@me`), { authPrefix: `Bearer` }).then((res) => res as RESTGetAPICurrentUserResult).catch((err) => {
                Logger.error(`Error fetching Discord user info: ${parseErrorMessage(err)}`);
                throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR', message: `Failed to fetch user info from Discord.` });
            });

            const dbUser = ctx.user;
            if (dbUser.discordId && dbUser.discordId !== userInfo.id) {
                throw new TRPCError({ code: 'CONFLICT', message: `Your account is already linked to a different Discord account.` });
            }

            let existingUserWithDiscord = await User.findOne({ where: { 
                id: { [Op.ne]: dbUser.id },
                discordId: userInfo.id, 
                githubId: { [Op.ne]: null }
            } });

            if (existingUserWithDiscord) {
                Logger.warn(`Merging user ${existingUserWithDiscord.username} (${existingUserWithDiscord.id}) into ${dbUser.username} (${dbUser.id}) due to Discord account linking.`);

                await existingUserWithDiscord.migrateUserItems(dbUser).then(() => {
                    existingUserWithDiscord.destroy();
                }).catch((err) => {
                    Logger.error(`Error merging user ${existingUserWithDiscord.username} (${existingUserWithDiscord.id}) into ${dbUser.username} (${dbUser.id}): ${parseErrorMessage(err)}`);
                });
            }

            await dbUser.update({
                discordId: userInfo.id,
            });

            if (ctx.res) {
                ctx.res.send(`<head><meta http-equiv="refresh" content="0; url=${stateObj.redirectUrl.href}" /></head><body style="background-color: black;"><a style="color:white;" href="${stateObj.redirectUrl.href}">Click here if you are not redirected...</a></body>`);
            }
            return;
        }), 
        // #endregion
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

})