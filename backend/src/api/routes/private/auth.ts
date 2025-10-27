import { Router } from 'express';
import { Logger } from '../../../shared/Logger.ts';
import { Validator } from '../../../shared/Validator.ts';
import { createRandomString, parseErrorMessage } from '../../../shared/Tools.ts';
import { EnvConfig } from '../../../shared/EnvConfig.ts';
import { User, UserPermissions } from '../../../shared/Database.ts';
import { authProcedure, router } from '../../trpc.ts';
import { REST, RESTGetAPICurrentUserResult, RESTOAuth2AuthorizationQuery, RESTPostOAuth2AccessTokenWithBotAndGuildsScopeResult, RESTPostOAuth2ClientCredentialsResult, Routes } from 'discord.js';
import { OAuth2API } from '@discordjs/core';

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
    discordAuthInit: authProcedure(`any`)
        .input(Validator.z.object({
            redirect: Validator.z.url().optional(),
        }))
        .output(Validator.z.object({
            url: Validator.z.url(),
        }))
        .query(async ({ input, ctx, path }) => {
            let state = prepAuth(ctx.req.ip || ``, input.redirect ?? EnvConfig.server.frontendUrl);
            if (!state) {
                throw new Error(`Could not prepare authentication.`);
            }

            let RESTClient = new REST({ version: '10' });
            let oauth2 = new OAuth2API(RESTClient);
            let url = oauth2.generateAuthorizationURL({
                client_id: EnvConfig.auth.discord.clientId,
                redirect_uri: `${EnvConfig.server.backendUrl}/api/auth/discord/callback`,
                response_type: 'code',
                scope: 'identify',
                state: state,
            })

            return { url };
        }),
    discordAuthCallback: authProcedure(`any`)
        .meta({ openapi: { method: 'GET', path: '/auth/discord/callback', tags: ['Authentication'] } })
        .input(Validator.z.object({
            code: Validator.z.string(),
            state: Validator.z.string(),
        }))
        .output(Validator.z.void())
        .query(async ({ input, ctx }) => {
            let stateObj = validStates.find((s) => s.stateId === input.state && s.ip === ctx.req.ip);
            if (!stateObj) {
                throw new Error(`Invalid state.`);
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
            let userInfo = await RESTClient.get(Routes.user(`@me`), {authPrefix: `Bearer`}).then((res) => res as RESTGetAPICurrentUserResult).catch((err) => {
                Logger.error(`Error fetching Discord user info: ${parseErrorMessage(err)}`);
                throw new Error(`Failed to fetch user info from Discord.`, err);
            });

            let dbUser = await User.findByPk(userInfo.id);
            if (!dbUser) {
                dbUser = await User.create({
                    id: userInfo.id,
                    username: userInfo.username,
                    displayName: userInfo.global_name ?? userInfo.username,
                    roles: [UserPermissions.Create_Assets],
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
                    throw new Error(`Internal server error.`);
                }
            });
            if (ctx.res) {
                ctx.res.send(`<head><meta http-equiv="refresh" content="0; url=${stateObj.redirectUrl.href}" /></head><body style="background-color: black;"><a style="color:white;" href="${stateObj.redirectUrl.href}">Click here if you are not redirected...</a></body>`);
            }
            return;
        }),
    logout: authProcedure(`loggedIn`)
        .input(Validator.z.object({
            redirect: Validator.z.url().optional(),
        }))
        .mutation(async ({ input, ctx }) => {
            return new Promise<{ message: string }>((resolve, reject) => {
                ctx.req.session.destroy((err) => {
                    if (err) {
                        Logger.error(`Error destroying session: ${parseErrorMessage(err)}`);
                        return reject(new Error(`Internal server error.`));
                    }
                    resolve({ message: `Logged out successfully.` });
                });
            });
        }),

})