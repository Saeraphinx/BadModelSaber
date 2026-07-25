import { anyProcedure, loggedInProcedure, router } from "../../trpc.ts";
import { getGitVersion } from "../../../shared/Tools.ts";
import { AdminRouter } from "./admin.ts";
import { User, UserPermissions } from "../../../shared/Database.ts";
import { REST, RESTGetAPICurrentUserResult } from "discord.js";
import z from "zod";

export const statusRouter = router({
    status: anyProcedure().
        meta({
            openapi: {
                method: 'GET',
                path: '/status',
                tags: ['Status'],
            }
        })
        .input(z.void())
        .output(z.object({
            message: z.string(),
            timestamp: z.string(),
            isDocker: z.boolean(),
            environment: z.string(),
            version: z.string(),
        }))
        .query(() => {
            return {
                message: `Server is running`,
                timestamp: new Date().toISOString(),
                isDocker: process.env.DOCKER === `true`,
                environment: process.env.NODE_ENV || `unknown`,
                version: getGitVersion(),
            };
        }),
    adminStatus: loggedInProcedure({
        hasOneOf: [
            UserPermissions.Administrative_Tasks,
            UserPermissions.Mods_Approval,
            UserPermissions.Game_Create,
            UserPermissions.Game_Edit,
            UserPermissions.Game_EditVersions,
            UserPermissions.Game_ViewExtras,
            UserPermissions.Users_Ban,
            UserPermissions.Users_EditAllRoles
        ]
    }).query(async ({ ctx }) => {
        let dbConnectionOK = await User.sequelize?.authenticate().then(() => `Connected`).catch(() => `Error`);
        let serverTime = new Date().toISOString();
        let isDocker = process.env.DOCKER === `true`;
        let environment = process.env.NODE_ENV || `unknown`;
        let version = getGitVersion();
        let discordTokenUser = await new REST({ version: `10` }).setToken(process.env.DISCORD_TOKEN || ``).get(`/users/@me`).then(discordUser => {
            let user = discordUser as RESTGetAPICurrentUserResult
            return {
                id: user.id,
                username: user.username,
                global_name: user.global_name,
                discriminator: user.discriminator,
                avatar: user.avatar,
            };
        }).catch(() => {
            return undefined;
        });
        return {
            dbConnectionOK,
            serverTime,
            isDocker,
            environment,
            version,
            discordTokenUser,
        };
    }),
});