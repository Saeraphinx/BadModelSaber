import { Router } from "express";
import { auth, validate } from "../../RequestUtils.ts";
import { Alert } from "../../../shared/Database.ts";
import { Validator } from "../../../shared/Validator.ts";
import { parseErrorMessage } from "../../../shared/Tools.ts";
import { Logger } from "../../../shared/Logger.ts";

export class AlertRoutes {
    public static loadRoutes(router: Router): void {
        router.get(`/alerts`, auth(`loggedIn`, true), async (req, res) => {
            const { responded, data } = validate(req, res, `query`, Validator.z.object({ read: Validator.z.coerce.boolean().default(false) }));
            if (!req.auth.isAuthed || responded) {
                return;
            }

            await Alert.findAll({
                where: {
                    userId: req.auth.user.id,
                    read: data.read
                },
                order: [[`createdAt`, `DESC`]]
            }).then(alerts => {
                if (alerts.length === 0) {
                    res.status(204).send();
                    return;
                }

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