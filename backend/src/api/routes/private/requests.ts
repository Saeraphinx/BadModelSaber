
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
        actuallyHandle: z.boolean().optional().default(false) 
    })).mutation(async ({ input, ctx }) => {
        const assetReq = await ThingRequest.findByPk(input.id);
        if (!assetReq) {
            throw new TRPCError({code: `NOT_FOUND`, message: `Request not found`});
        }
        if (!assetReq.canAccept(ctx.user)) {
            throw new TRPCError({code: `FORBIDDEN`, message: `You are not allowed to handle this request`});
        }
        if (input.action === `accept`) {
            await assetReq.accept(ctx.user, input.actuallyHandle).catch(handleCatch());
            return { message: `Request accepted successfully` };
        } else if (input.action === `decline`) {
            await assetReq.decline(ctx.user).catch(handleCatch());
            return { message: `Request declined successfully` };
        }
        throw new TRPCError({ code: `BAD_REQUEST`, message: `Invalid action` });
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

