import { Router } from 'express';
import { Logger } from '../../../shared/Logger.ts';
import { Validator } from '../../../shared/Validator.ts';
import { createRandomString, parseErrorMessage } from '../../../shared/Tools.ts';
import { EnvConfig } from '../../../shared/EnvConfig.ts';
import { User } from '../../../shared/Database.ts';
import { authProcedure, router } from '../../trpc.ts';
import * as OpenIDClient from 'openid-client';
import { RESTGetAPICurrentUserResult } from 'discord.js';

let discordConfig: OpenIDClient.Configuration;
const DiscordUserEndpoint = new URL(`https://discord.com/api/v10/users/@me`);
export function loadAuthConfig() {
    if (!EnvConfig.auth.discord.clientSecret || !EnvConfig.auth.discord.clientId) {
        Logger.warn(`Discord authentication is not configured.`);
        return;
    }

    discordConfig = new OpenIDClient.Configuration({
        issuer: `https://discord.com`,
        token_endpoint: `https://discord.com/api/v10/oauth2/token`,
        revocation_endpoint: `https://discord.com/api/v10/oauth2/token/revoke`,
        authorization_endpoint: `https://discord.com/oauth2/authorize`,
        grant_types_supported: [`authorization_code`],
    }, EnvConfig.auth.discord.clientSecret, EnvConfig.auth.discord.clientSecret);
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
            url: Validator.z.string(),
        }))
        .query(async ({ input, ctx, path }) => {
            let state = prepAuth(ctx.req.ip || ``, input.redirect || EnvConfig.server.frontendUrl);
            if (!state) {
                throw new Error(`Could not prepare authentication.`);
            }

            if (!discordConfig) {
                throw new Error(`Discord authentication is not configured.`);
            }

            let url = OpenIDClient.buildAuthorizationUrl(discordConfig, {
                redirect_uri: `${EnvConfig.server.backendUrl}${EnvConfig.server.apiRoute}/auth/discord/callback`,
                scope: `identify`,
                state: state,
                response_type: `code`,
            })

            if (ctx.req.path.includes(`trpc`)) {
                return { url: url.toString() };
            } else {
                throw new Error(`Invalid request to ${path}`);
            }
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

            if (!discordConfig) {
                throw new Error(`Discord authentication is not configured.`);
            }

            let tokenSet = await OpenIDClient.authorizationCodeGrant(discordConfig, new URL(ctx.req.originalUrl), {
                expectedState: stateObj.stateId,
            });

            let userInfo: RESTGetAPICurrentUserResult = await OpenIDClient.fetchProtectedResource(discordConfig, tokenSet.access_token, DiscordUserEndpoint, `GET`).then(res => res.json() as Promise<any>).catch(err => {
                throw new Error(`Error fetching user info from Discord: ${parseErrorMessage(err)}`);
            });

            let dbUser = await User.findByPk(userInfo.id);
            if (!dbUser) {
                dbUser = await User.create({
                    id: userInfo.id,
                    username: userInfo.username,
                    displayName: userInfo.global_name || userInfo.username,
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
                ctx.res.redirect(stateObj.redirectUrl.toString());
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