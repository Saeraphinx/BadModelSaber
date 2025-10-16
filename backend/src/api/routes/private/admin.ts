import { Router } from "express";
import { auth, validate } from "../../../api/RequestUtils.ts";
import { Alert, User, UserPermissions } from "../../../shared/Database.ts";
import { Validator } from "../../../shared/Validator.ts";
import z from "zod/v4";
import { dedupeArray } from "../../../shared/Tools.ts";

export class AdminRoutes {
    public static loadRoutes(router: Router): void {
        router.post(`/admin/roles`, auth([UserPermissions.Manage_All_Users, UserPermissions.Manage_NonMod_Users]), async (req, res) => {
            let { responded, data } = validate(req, res, `body`, z.object({
                userId: Validator.zNumberID,
                add: Validator.z.array(Validator.z.enum(UserPermissions))
                    .optional()
                    .default([]),
                remove: Validator.z.array(Validator.z.enum(UserPermissions))
                    .optional()
                    .default([]),
            }));

            if (responded || !req.auth.isAuthed) {
                return;
            }

            // check user persmissions to see if they can assign/remove the specificed roles
            for (let role of [...data!.add, ...data!.remove]) {
                if (role.startsWith(`c_`) ||
                    role === UserPermissions.Manage_All_Users ||
                    role === UserPermissions.Manage_NonMod_Users ||
                    role === UserPermissions.Approve_Assets) {
                    if (!req.auth.user!.roles.includes(UserPermissions.Manage_All_Users)) {
                        res.status(403).json({ message: `You do not have permission to manage the role: ${role}` });
                        return;
                    }
                }
            }

            let targetUser = await User.findByPk(data!.userId);
            if (!targetUser) {
                res.status(404).json({ message: `User not found` });
                return;
            }

            if (data?.add) {
                targetUser.roles = dedupeArray([...targetUser.roles, ...data.add]);
            }
            if (data?.remove) {
                targetUser.roles = targetUser.roles.filter(role => !data!.remove.includes(role));
            }
            await targetUser.save().then(() => {
                res.status(200).json({ message: `User roles updated successfully`, roles: targetUser.roles });
            }).catch(err => {
                res.status(500).json({ message: `Error updating user roles: ${err.message}` });
            });
        });

        router.post(`/admin/createAlert`, auth([UserPermissions.Manage_All_Users, UserPermissions.Manage_NonMod_Users]), async (req, res) => {
            let { responded, data } = validate(req, res, `body`, Alert.createValidator);
            if (responded || !req.auth.isAuthed) {
                return;
            }

            await Alert.create({
                header: data!.header,
                message: data!.message,
                type: data!.type,
                requestId: data!.requestId,
                assetId: data!.assetId,
                userId: data!.userId,
            }).then(() => {
                res.status(200).json({ message: `Alert created successfully` });
            }).catch(err => {
                res.status(500).json({ message: `Error creating alert: ${err.message}` });
            });
        });
    }
}