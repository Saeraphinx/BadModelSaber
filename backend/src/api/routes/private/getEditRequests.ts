
import { Asset, ThingRequest,  RequestType, UserPermissions, dbId, ThingRequestInfer } from "../../../shared/Database.ts";
import { z } from "zod/v4";
import { Op, WhereOptions } from "sequelize";
import { loggedInProcedure, router } from "../../trpc.ts";
import { TRPCError } from "@trpc/server";
import { handleCatch, parseErrorMessage } from "../../../shared/Tools.ts";

export const RequestRouter = router({
    getMyRequests: loggedInProcedure().input(z.object({
        gameName: z.string().optional(),
        includeActioned: z.boolean().optional().default(false),
        thingId: z.number().int().positive().optional()
    })).query(async ({ input, ctx }) => {
        const whereOptions: WhereOptions<ThingRequestInfer> = {};

        if (input.thingId) {
            whereOptions.refrencedId = input.thingId;
        }
        if (!input.includeActioned) {
            whereOptions.accepted = null;
        }

        let incoming = ThingRequest.findAll({
            where: {
                requestResponseBy: ctx.user.id,
                ...whereOptions
            },
            include: { all: true },
        });
        let outgoing = ThingRequest.findAll({
            where: {
                requesterId: ctx.user.id,
                ...whereOptions
            },
            include: { all: true },
        });

        const [incomingRequests, outgoingRequests] = await Promise.all([incoming, outgoing]);
        return {
            incoming: await Promise.all(incomingRequests.map(req => req.toApiV3())),
            outgoing: await Promise.all(outgoingRequests.map(req => req.toApiV3())),
        };
    }),
    requestCounts: loggedInProcedure().query(async ({ ctx }) => {
        let incoming = await ThingRequest.count({
            where: {
                requestResponseBy: ctx.user.id,
                accepted: null
            }
        });
        let outgoing = await ThingRequest.count({
            where: {
                requesterId: ctx.user.id,
                accepted: null
            }
        });
        return { incoming: incoming ?? 0, outgoing: outgoing ?? 0 };
    }),
    getRequest: loggedInProcedure().input(z.object({
        id: dbId,
    })).query(async ({ input, ctx }) => {
        const thingRequest = await ThingRequest.findByPk(input.id, { include: { all: true }});
        if (!thingRequest) {
            throw new TRPCError({code: `NOT_FOUND`, message: `Request not found`});
        }
        if (!thingRequest.canView(ctx.user)) {
            throw new TRPCError({code: `FORBIDDEN`, message: `You are not allowed to message this request`});
        }
        return await thingRequest.toApiV3();
    }),
    addMessage: loggedInProcedure().input(z.object({
        id: dbId,
        message: z.string().min(1).max(2048)
    })).mutation(async ({ input, ctx }) => {
        const assetReq = await ThingRequest.findByPk(input.id);
        if (!assetReq) {
            throw new TRPCError({code: `NOT_FOUND`, message: `Request not found`});
        }
        if (!assetReq.canMessage(ctx.user)) {
            throw new TRPCError({code: `FORBIDDEN`, message: `You are not allowed to message this request`});
        }
        await assetReq.addMessage(ctx.user, input.message).catch(handleCatch());
        return { message: `Message added successfully` };
    }),
    handleRequest: loggedInProcedure().input(z.object({
        id: dbId,
        action: z.enum([`accept`, `decline`]),
    })).mutation(async ({ input, ctx }) => {
        const assetReq = await ThingRequest.findByPk(input.id);
        if (!assetReq) {
            throw new TRPCError({code: `NOT_FOUND`, message: `Request not found`});
        }
        if (!assetReq.canAccept(ctx.user)) {
            throw new TRPCError({code: `FORBIDDEN`, message: `You are not allowed to handle this request`});
        }
        if (input.action === `accept`) {
            await assetReq.accept(ctx.user).catch(handleCatch());
            return { message: `Request accepted successfully` };
        } else if (input.action === `decline`) {
            await assetReq.decline(ctx.user).catch(handleCatch());
            return { message: `Request declined successfully` };
        }
        throw new Error(`Invalid action`);
    }),
    reportAsset: loggedInProcedure().input(z.object({
        assetId: dbId,
        reason: z.string().min(3).max(1000),
    })).mutation(async ({ input, ctx }) => {
        let asset = await Asset.findByPk(input.assetId);
        if (!asset) {
            throw new TRPCError({ code: `NOT_FOUND`, message: `Asset not found` });
        }

        let assetReq = await asset.report(ctx.user, input.reason).catch(handleCatch());
        return await assetReq.toApiV3().catch(handleCatch());;
    })
});

/*
export class RequestRoutes {
    // yea its not reall
    public static loadRoutes(router: Router): void {
        router.get(`/requests`, auth(`loggedIn`, true), (req, res) => {
            const { responded, data } = validate(req, res, `query`, Validator.z.object({ 
                includeActioned: Validator.z.coerce.boolean().default(false),
                assetId: Validator.zNumberID.optional()
            }));
            if (!req.auth.isAuthed || responded) {
                return;
            }

            let isElevated = req.auth.user.roles.includes(UserPermissions.Manage_All_Reports);
            let bailOut = false;

            const whereOptions: WhereOptions<AssetRequestInfer> = {};
            if (data.assetId) {
                whereOptions.refrencedAssetId = data.assetId;
            }
            if (!data.includeActioned) {
                whereOptions.accepted = null;
            }
            

            let incoming = AssetRequest.findAll({
                where: {
                    requestResponseBy: req.auth.user.id,
                    ...whereOptions
                },
                include: { all: true },
            }).catch(err => {
                Logger.warn(`Error fetching incoming requests: ${parseErrorMessage(err)}`);
                res.status(500).json({ message: `Error fetching incoming requests: ${parseErrorMessage(err)}` });
                bailOut = true;
            });
            if (bailOut) {
                return;
            }
            let outgoing = AssetRequest.findAll({
                where: {
                    requesterId: req.auth.user.id,
                    ...whereOptions
                },
                include: { all: true },
            }).catch(err => {
                Logger.warn(`Error fetching outgoing requests: ${parseErrorMessage(err)}`);
                res.status(500).json({ message: `Error fetching outgoing requests: ${parseErrorMessage(err)}` });
                bailOut = true;
            });
            if (bailOut) {
                return;
            }

            let reports = null;
            if (isElevated) {
                reports = AssetRequest.findAll({
                    where: {
                        requestType: RequestType.Report,
                        ...whereOptions
                    },
                    include: { all: true },
                }).catch(err => {
                    Logger.warn(`Error fetching report requests: ${parseErrorMessage(err)}`);
                    res.status(500).json({ message: `Error fetching report requests: ${parseErrorMessage(err)}` });
                    bailOut = true;
                });
            }
            if (bailOut) {
                return;
            }

            Promise.all([incoming, outgoing, reports]).then(async ([incomingRequests, outgoingRequests, reportRequests]) => {
                if (!incomingRequests || !outgoingRequests) {
                    res.status(500).json({ message: `Error fetching requests` });
                    return;
                }

                res.status(200).json({
                    incoming: await Promise.all(incomingRequests.map(req => req.getAPIResponse())),
                    outgoing: await Promise.all(outgoingRequests.map(req => req.getAPIResponse())),
                    reports: reportRequests ? await Promise.all(reportRequests.map(req => req.getAPIResponse())) : null
                });
            }).catch(err => {
                res.status(500).json({ message: `Error fetching requests: ${parseErrorMessage(err)}` });
            });
        });

        router.get(`/requests/counts`, auth(`loggedIn`, true), async (req, res) => {
            if (!req.auth.isAuthed) {
                res.status(401).json({ message: `You must be logged in to view request counts` });
                return;
            }

            let incoming = await AssetRequest.count({
                where: {
                    requestResponseBy: req.auth.user.id,
                    accepted: null
                }
            }).catch(err => {
                res.status(500).json({ message: `Error fetching request count: ${parseErrorMessage(err)}` });
            });

            let outgoing = await AssetRequest.count({
                where: {
                    requesterId: req.auth.user.id,
                    accepted: null
                }
            }).catch(err => {
                res.status(500).json({ message: `Error fetching request count: ${parseErrorMessage(err)}` });
            });

            let reports = null;
            if (req.auth.user.roles.includes(UserPermissions.View_All_Reports)) {
                reports = await AssetRequest.count({
                    where: {
                        requestType: RequestType.Report,
                        accepted: null
                    }
                }).catch(err => {
                    res.status(500).json({ message: `Error fetching report count: ${parseErrorMessage(err)}` });
                });
            }

            res.status(200).json({ incoming: incoming ?? 0, outgoing: outgoing ?? 0, reports: reports ?? null });
            return;
        });

        router.get(`/requests/:id`, auth(`loggedIn`, true), (req, res) => {
            const { responded, data } = validate(req, res, `params`, Validator.z.object({
                id: Validator.zNumberID,
            }));
            if (!req.auth.isAuthed || responded) {
                return;
            }

            let isElevated = req.auth.user.roles.includes(UserPermissions.View_All_Reports);

            AssetRequest.findByPk(data.id, { include: { all: true }}).then(async assetReq => {
                if (!assetReq) {
                    res.status(404).json({ message: `Request not found` });
                    return;
                }

                if (!isElevated && assetReq.requesterId !== req.auth.user?.id && assetReq.requestResponseBy !== req.auth.user?.id) {
                    res.status(403).json({ message: `You are not allowed to view this request` });
                    return;
                }

                res.status(200).json(await assetReq.getAPIResponse());
            }).catch(err => {
                res.status(500).json({ message: `Error fetching request: ${parseErrorMessage(err)}` });
            });
        });

        router.post(`/requests/:id/messages`, auth(`loggedIn`, true), async (req, res) => { 
            const { responded: pResponded, data: query } = validate(req, res, `params`, Validator.z.object({
                id: Validator.zNumberID
            }));
            const { responded: bResponded, data: body } = validate(req, res, `body`, Validator.z.object({
                message: Validator.z.string().min(1)
            }));
            if (!req.auth.isAuthed || pResponded || bResponded) {
                return;
            }

            let assetReq = await AssetRequest.findByPk(query.id);
            if (!assetReq) {
                res.status(404).json({ message: `Request not found` });
                return;
            }

            if (!assetReq.allowedToMessage(req.auth.user)) {
                res.status(403).json({ message: `You are not allowed to message this request` });
                return;
            }

            await assetReq.addMessage(req.auth.user, body.message).then(() => {
                res.status(200).json({ message: `Message added successfully` });
            }).catch(err => {
                res.status(500).json({ message: `Error adding message: ${parseErrorMessage(err)}` });
            });
        })

        router.post(`/requests/:id/:action`, auth(`loggedIn`, true), async (req, res) => {
            const { responded: qResponded, data: pData } = validate(req, res, `params`, Validator.z.object({
                id: Validator.zNumberID,
                action: Validator.z.enum([`accept`, `decline`, `message`])
            }));
            if (!req.auth.isAuthed || qResponded) {
                return;
            }

            let assetReq = await AssetRequest.findByPk(pData.id);
            if (!assetReq) {
                res.status(404).json({ message: `Request not found` });
                return;
            }

            if (pData.action === `message`) {
                const { responded: bResponded, data: body } = validate(req, res, `body`, Validator.z.object({
                    message: Validator.z.string().min(1)
                }));
                if (bResponded) {
                    return;
                }

                if (!assetReq.allowedToMessage(req.auth.user)) {
                    res.status(403).json({ message: `You are not allowed to message this request` });
                    return;
                }

                await assetReq.addMessage(req.auth.user, body.message);
                res.status(200).json({ message: `Message added successfully` });
                return;
            } else {
                // Accept or decline the request
                if (!assetReq.allowedToAccept(req.auth.user)) {
                    res.status(403).json({ message: `You are not allowed to ${pData.action} this request` });
                    return;
                }

                let promise: Promise<any>;
                if (pData.action === `accept`) {
                    promise = assetReq.accept(req.auth.user.id);
                    res.status(200).json({ message: `Request accepted successfully` });
                } else if (pData.action === `decline`) {
                    promise = assetReq.decline(req.auth.user.id);
                    res.status(200).json({ message: `Request declined successfully` });
                } else {
                    res.status(400).json({ message: `Invalid action` });
                    return;
                }

                await promise.then(() => {
                    res.status(200).json({ message: `Request ${pData.action}${pData.action === `accept` ? `ed` : `d`} successfully.` });
                }).catch(err => {
                    res.status(500).json({ message: `Error processing request: ${parseErrorMessage(err)}` });
                });
                return;
            }
        });
    }
}
*/