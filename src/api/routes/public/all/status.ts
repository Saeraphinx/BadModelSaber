import { Router } from "express";
import { getGitVersion } from "../../../../shared/Tools.ts";

export class StatusRoutes {
    public static loadRoutes(router: Router): void {
        router.get(`/status`, (req, res) => {
            res.status(200).json({
                message: `Server is running`,
                timestamp: new Date().toISOString(),
                isDocker: process.env.DOCKER === `true`,
                environment: process.env.NODE_ENV || `unknown`,
                version: getGitVersion(),
            });
        });
    }
}