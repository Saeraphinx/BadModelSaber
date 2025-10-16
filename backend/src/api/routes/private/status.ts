import { authProcedure, router } from "../../trpc.ts";
import { getGitVersion } from "../../../shared/Tools.ts";

export const statusRouter = router({
    status: authProcedure(`any`).query(() => {
        return {
            message: `Server is running`,
            timestamp: new Date().toISOString(),
            isDocker: process.env.DOCKER === `true`,
            environment: process.env.NODE_ENV || `unknown`,
            version: getGitVersion(),
        };
    })
});