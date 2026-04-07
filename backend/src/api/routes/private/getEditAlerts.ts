import { Router } from "express";
import { Alert, AlertInfer, alertApiV3Schema } from "../../../shared/Database.ts";
import { Validator } from "../../../shared/Validator.ts";
import { handleCatch, parseErrorMessage } from "../../../shared/Tools.ts";
import { Logger } from "../../../shared/Logger.ts";
import { WhereOptions } from "sequelize";
import { loggedInProcedure, router } from "../../trpc.ts";
import { TRPCError } from "@trpc/server";
import { z } from "zod/v4";

export const alertsRouter = router({
    getAlertCount: loggedInProcedure().query(async ({ ctx }) => {
        const count = await Alert.count({
            where: {
                userId: ctx.user.id,
                read: false,
            }
        }).catch(handleCatch());
        return count;
    }),
    getAlerts: loggedInProcedure()
        .input(z.object({ 
            read: z.enum([`true`, `false`, `all`]).default(`false`) }
        ))
        .output(z.array(alertApiV3Schema))
        .query(async ({input, ctx}) => {
        let whereOptions: WhereOptions<AlertInfer> = {
            userId: ctx.user.id,
        };
        if (input.read === `true`) {
            whereOptions.read = true;
        } else if (input.read === `false`) {
            whereOptions.read = false;
        }
        const alerts = await Alert.findAll({
            where: whereOptions,
            order: [[`createdAt`, `DESC`]]
        });
        return alerts.map(a => a.toApiV3());
    }),
    markAlertRead: loggedInProcedure().input(z.object({
        id: z.number().int().positive()
    })).mutation(async ({input, ctx}) => {
        const alert = await Alert.findByPk(input.id);
        if (!alert) {
            throw new TRPCError({ code: `NOT_FOUND`, message: `Alert not found`});
        }
        if (alert.userId !== ctx.user.id) {
            throw new TRPCError({ code: `FORBIDDEN`, message: `You are not allowed to read this alert`});
        }
        alert.read = true;
        alert.discordMessageSent = true;
        await alert.save().catch(handleCatch());
        Logger.debug(`Alert ${alert.id} marked as read for user ${ctx.user.id}`);
        return alert.toApiV3();
    }),
    deleteAlert: loggedInProcedure().input(z.object({
        id: z.number().int().positive()
    })).mutation(async ({input, ctx}) => {
        const alert = await Alert.findByPk(input.id);
        if (!alert) {
            throw new TRPCError({ code: `NOT_FOUND`, message: `Alert not found`});
        }
        if (alert.userId !== ctx.user.id) {
            throw new TRPCError({ code: `FORBIDDEN`, message: `You are not allowed to delete this alert`});
        }
        await alert.destroy().catch(handleCatch());
        Logger.debug(`Alert ${alert.id} deleted for user ${ctx.user.id}`);
        return;
    })
});

/*

export class AlertRoutes {
    public static loadRoutes(router: Router): void {
        router.get(`/alerts`, auth(`loggedIn`, true), async (req, res) => {
            const { responded, data } = validate(req, res, `query`, Validator.z.object({ read: Validator.z.enum([`true`, `false`, `all`]).default(`false`) }));
            console.log(!req.auth.isAuthed || responded);
            if (!req.auth.isAuthed || responded) {
                return;
            }

            let whereOptions: WhereOptions<AlertInfer> = {
                userId: req.auth.user.id,
            };

            if (data.read === `true`) {
                whereOptions.read = true;
            } else if (data.read === `false`) {
                whereOptions.read = false;
            }

            await Alert.findAll({
                where: whereOptions,
                order: [[`createdAt`, `DESC`]]
            }).then(alerts => {
                res.status(200).json(alerts.map(a => a.toAPIResponse()));
            }).catch(err => {
                res.status(500).json({ error: `Error fetching alerts: ${parseErrorMessage(err)}` });
            });
        });

        router.post(`/alerts/:id/read`, auth(`loggedIn`, true), async (req, res) => {
            const { responded, data: params } = validate(req, res, `params`, Validator.z.object({
                id: Validator.zNumberID
            }));
            if (!req.auth.isAuthed || responded) {
                return;
            }

            await Alert.findByPk(params.id).then(async alert => {
                if (!alert) {
                    res.status(404).json({ message: `Alert not found` });
                    return;
                }

                if (alert.userId !== req.auth.user?.id) {
                    res.status(403).json({ message: `You are not allowed to read this alert` });
                    return;
                }

                alert.read = true;
                alert.discordMessageSent = true;
                await alert.save().then(() => {
                    Logger.debug(`Alert ${alert.id} marked as read for user ${req.auth.user?.id}`);
                    res.status(200).json(alert.toAPIResponse());
                }).catch(err => {
                    res.status(500).json({ message: `Error updating alert: ${parseErrorMessage(err)}` });
                });
            }).catch(err => {
                res.status(500).json({ message: `Error fetching alert: ${parseErrorMessage(err)}` });
            });
        });

        router.delete(`/alerts/:id`, auth(`loggedIn`, true), async (req, res) => {
            const { responded, data: params } = validate(req, res, `params`, Validator.z.object({
                id: Validator.zNumberID
            }));
            if (!req.auth.isAuthed || responded) {
                return;
            }

            await Alert.findByPk(params.id).then(async alert => {
                if (!alert) {
                    res.status(404).json({ message: `Alert not found` });
                    return;
                }

                if (alert.userId !== req.auth.user?.id) {
                    res.status(403).json({ message: `You are not allowed to delete this alert` });
                    return;
                }

                await alert.destroy().then(() => {
                    Logger.debug(`Alert ${alert.id} deleted for user ${req.auth.user?.id}`);
                    res.status(204).json();
                }).catch(err => {
                    res.status(500).json({ message: `Error deleting alert: ${parseErrorMessage(err)}` });
                });
            }).catch(err => {
                res.status(500).json({ message: `Error fetching alert: ${parseErrorMessage(err)}` });
            });
        });
    }
}
*/