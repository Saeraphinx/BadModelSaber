import { Router } from "express";
import { auth, validate } from "../../RequestUtils.ts";
import { Alert } from "../../../shared/Database.ts";
import { Validator } from "../../../shared/Validator.ts";
import { parseErrorMessage } from "../../../shared/Tools.ts";

export class AlertRoutes {
    public static loadRoutes(router: Router): void {
        router.get(`/alerts`, auth(`loggedIn`, true), (req, res) => {
            const { responded, data } = validate(req, res, `query`, Validator.z.object({ read: Validator.z.boolean().default(false) }));
            if (!req.auth.isAuthed || responded) {
                return;
            }

            Alert.findAll({
                where: {
                    userId: req.auth.user.id,
                    read: data.read
                },
                order: [[`createdAt`, `DESC`]]
            }).then(alerts => {
                if (alerts.length === 0) {
                    res.status(204).json({ message: `No alerts found` });
                    return;
                }

                res.status(200).json(alerts.map(a => a.toAPIResponse()));
            }).catch(err => {
                res.status(500).json({ error: `Error fetching alerts: ${parseErrorMessage(err)}` });
            });
        });

        router.post(`/alerts/:id/read`, auth(`loggedIn`, true), (req, res) => {
            const { responded, data: id } = validate(req, res, `params`, Validator.zNumberID);
            if (!req.auth.isAuthed || responded) {
                return;
            }

            Alert.findByPk(id).then(alert => {
                if (!alert) {
                    res.status(404).json({ error: `Alert not found` });
                    return;
                }

                if (alert.userId !== req.auth.user?.id) {
                    res.status(403).json({ error: `You are not allowed to read this alert` });
                    return;
                }

                alert.read = true;
                alert.discordMessageSent = true;
                alert.save().then(() => {
                    res.status(200).json({ message: `Alert marked as read` });
                }).catch(err => {
                    res.status(500).json({ error: `Error updating alert: ${parseErrorMessage(err)}` });
                });
            }).catch(err => {
                res.status(500).json({ error: `Error fetching alert: ${parseErrorMessage(err)}` });
            });
        });

        router.delete(`/alerts/:id`, auth(`loggedIn`, true), (req, res) => {
            const { responded, data: id } = validate(req, res, `params`, Validator.zNumberID);
            if (!req.auth.isAuthed || responded) {
                return;
            }

            Alert.findByPk(id).then(alert => {
                if (!alert) {
                    res.status(404).json({ error: `Alert not found` });
                    return;
                }

                if (alert.userId !== req.auth.user?.id) {
                    res.status(403).json({ error: `You are not allowed to delete this alert` });
                    return;
                }

                alert.destroy().then(() => {
                    res.status(200).json({ message: `Alert deleted successfully` });
                }).catch(err => {
                    res.status(500).json({ error: `Error deleting alert: ${parseErrorMessage(err)}` });
                });
            }).catch(err => {
                res.status(500).json({ error: `Error fetching alert: ${parseErrorMessage(err)}` });
            });
        });
    }
}