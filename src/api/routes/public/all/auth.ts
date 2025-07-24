import { Router } from 'express';
import passport from 'passport';
import { Strategy as DiscordStrategy } from 'passport-discord';
import { Logger } from '../../../../shared/Logger.ts';
import { Validator } from '../../../../shared/Validator.ts';
import { createRandomString, parseErrorMessage } from '../../../../shared/Tools.ts';
import { EnvConfig } from '../../../../shared/EnvConfig.ts';
import { User } from '../../../../shared/Database.ts';
import { validate } from '../../../RequestUtils.ts';

export class AuthRoutes {
    private static validStates: { stateId: string, ip: string, redirectUrl: URL, userId: number | null }[] = [];
    private static frontendBaseUrl = new URL(EnvConfig.server.frontendUrl);
    private static backendBaseUrl = new URL(EnvConfig.server.backendUrl);
    private static redirectValidator = Validator.z.object({
        redirect: Validator.z.url().default(EnvConfig.server.frontendUrl).refine((data) => {
            let url = new URL(data);
            return url.origin === AuthRoutes.frontendBaseUrl.origin || url.origin === AuthRoutes.backendBaseUrl.origin;
        }, `Redirect URL must start with the server base URL.`)
    })

    public static loadRoutes(router: Router) {
        if (!EnvConfig.auth.discord.clientSecret || !EnvConfig.auth.discord.clientId) {
            Logger.warn(`Discord authentication is not configured. Skipping Discord auth routes.`);
            return;
        }

        passport.use(new DiscordStrategy({
            clientID: EnvConfig.auth.discord.clientId,
            clientSecret: EnvConfig.auth.discord.clientSecret,
            callbackURL: `${EnvConfig.server.backendUrl}${EnvConfig.server.apiRoute}/auth/discord/callback`,
            scope: [`identify`],
        }, async function (accessToken, refreshToken, profile, done) {
            if (!profile) {
                return done(null, false);
            }
            if (!profile.id) {
                return done(null, false);
            }
            let dbUser = await User.findByPk(profile.id);
            if (!dbUser) {
                User.create({
                    id: profile.id,
                    username: profile.username,
                    displayName: profile.global_name || profile.username,
                    avatarUrl: profile.avatar ? `https://cdn.discordapp.com/avatars/${profile.id}/${profile.avatar}.png` : `https://cdn.discordapp.com/embed/avatars/${Number(profile.id) % 6}.png`,
                }).then((user) => {
                    Logger.info(`New user created: ${user.username} (${user.id})`);
                    return done(null, user);
                }).catch((err) => {
                    Logger.error(`Error creating user: ${err}`);
                    return done(err, false);
                });
            } else {
                dbUser.update({
                    username: profile.username,
                    displayName: profile.displayName,
                    avatarUrl: profile.avatar ? `https://cdn.discordapp.com/avatars/${profile.id}/${profile.avatar}.png` : `https://cdn.discordapp.com/embed/avatars/${Number(profile.id) % 6}.png`,
                }).then((user) => {
                    return done(null, user);
                }).catch((err) => {
                    Logger.error(`Error updating user: ${err}`);
                    return done(err, false);
                });
            }
            return done(null, false);
        }));

        router.get(`/auth/discord`, async (req, res, next) => {
            let { responded, data: query } = validate(req, res, `query`, AuthRoutes.redirectValidator);
            if (responded || !req.ip) {
                return;
            }
            let state = this.prepAuth(req.ip, query?.redirect || this.frontendBaseUrl.href);
            if (!state) {
                res.status(400).send({ error: `Invalid parameters.` });
                return;
            }
            passport.authenticate(`discord`, { state: state, session: false })(req, res, next);
        });

        router.get(`/auth/discord/callback`, passport.authenticate(`discord`, { failureRedirect: `/`, session: false }), async (req, res) => {
            let state = req.query[`state`];
            if (!state) {
                res.status(400).send({ error: `Invalid parameters.` });
                return;
            }
            let stateObj = this.validStates.find((s) => s.stateId === state && s.ip === req.ip);
            if (!stateObj) {
                res.status(400).send({ error: `Invalid state.` });
                return
            }
            this.validStates = this.validStates.filter((s) => s.stateId !== state);

            if (!req.user || !(req.user instanceof User)) {
                res.status(500).send({ error: `Internal server error.` });
                return
            } else if (req.user instanceof User) {
                Logger.info(`User ${req.user.username} (${req.user.id}) logged in via Discord.`);
                req.session.userId = req.user.id;
                req.session.save((err) => {
                    if (err) {
                        Logger.error(`Error saving session: ${parseErrorMessage(err)}`);
                        res.status(500).send({ error: `Internal server error.` });
                        return;
                    }
                })
            }
            res.status(200).send(`<head><meta http-equiv="refresh" content="0; url=${stateObj.redirectUrl.href}" /></head><body style="background-color: black;"><a style="color:white;" href="${stateObj.redirectUrl.href}">Click here if you are not redirected...</a></body>`);
            return;
        });


        router.get(`/auth/logout`, async (req, res) => {
            let { responded, data: query } = validate(req, res, `query`, AuthRoutes.redirectValidator);
            if (responded) {
                return;
            
            }
            req.session.destroy((err) => {
                if (err) {
                    res.status(500).send({ error: `Internal server error.` });
                    return
                }
                res.status(200).send(`<head><meta http-equiv="refresh" content="0; url=${query?.redirect}" /></head><body style="background-color: black;"><a style="color:white;" href="${query?.redirect}">Click here if you are not redirected...</a></body>`);
                return;
            });
        });
    }

    private static prepAuth(ip: string, redirectUrl: string, userId?: number, minsToTimeout = 5): string | null {
        let state = createRandomString(32);
        if (userId) {
            AuthRoutes.validStates.push({ stateId: state, ip: ip, redirectUrl: new URL(redirectUrl), userId });
        } else {
            AuthRoutes.validStates.push({ stateId: state, ip: ip, redirectUrl: new URL(redirectUrl), userId: null });
        }
        setTimeout(() => {
            AuthRoutes.validStates = this.validStates.filter((s) => s.stateId !== state);
        }, 1000 * 60 * minsToTimeout);
        return state;
    }
}