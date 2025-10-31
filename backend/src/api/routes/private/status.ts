import { authProcedure, router } from "../../trpc.ts";
import { getGitVersion } from "../../../shared/Tools.ts";
import { AdminRouter } from "./admin.ts";
import { User, UserPermissions } from "../../../shared/Database.ts";
import { REST, RESTGetAPICurrentUserResult } from "discord.js";

export const statusRouter = router({
    status: authProcedure(`any`).query(() => {
        return {
            message: `Server is running`,
            timestamp: new Date().toISOString(),
            isDocker: process.env.DOCKER === `true`,
            environment: process.env.NODE_ENV || `unknown`,
            version: getGitVersion(),
        };
    }),
    adminStatus: authProcedure([UserPermissions.Administative_Tasks]).query(async () => {
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
                descriminator: user.discriminator,
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