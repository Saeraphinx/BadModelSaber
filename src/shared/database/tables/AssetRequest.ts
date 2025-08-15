import { InferAttributes, Model, InferCreationAttributes, CreationOptional, NonAttribute } from "sequelize";
import { z } from "zod/v4";
import { AlertType, AssetRequestPublicAPIv3, LinkedAsset, LinkedAssetLinkType, RequestMessage, RequestType, Status, UserRole } from "../DBExtras.ts";
import { User } from "./User.ts";
import { Asset } from "./Asset.ts";
import { Alert } from "./Alert.ts";
import { Logger } from "../../Logger.ts";

export type AssetRequestInfer = InferAttributes<AssetRequest>;
export class AssetRequest extends Model<InferAttributes<AssetRequest>, InferCreationAttributes<AssetRequest>> {
    declare id: CreationOptional<number>;
    declare refrencedAssetId: number; // Asset ID that this request is for
    declare requesterId: string; // User ID of the person who made the request
    declare requestResponseBy: string | null; // User ID of the person who has been asked to respond to the request. null if this isn't for a specific user
    declare objectToAdd: string | LinkedAsset | null;

    declare requestType: RequestType;

    declare accepted: CreationOptional<boolean | null>; // Whether the request has been accepted or not
    declare resolvedBy: CreationOptional<string | null>; // User ID of the person who resolved the request, null if not resolved
    declare messages: CreationOptional<RequestMessage[]>; // Array of messages related to the request

    declare createdAt: CreationOptional<Date>; // Timestamp of when the request was created
    declare updatedAt: CreationOptional<Date>; // Timestamp of when the request was last updated
    declare deletedAt: CreationOptional<Date | null>; // Timestamp of when the request was deleted, null if not deleted

    public get refrencedAsset(): NonAttribute<Promise<Asset | null>> {
        return Asset.findByPk(this.refrencedAssetId);
    }


    // #region Validators
    public static validator = z.object({
        id: z.number().int().positive(),
        refrencedAssetId: z.number().int().min(1).refine(async (id) => await Asset.checkIfExists(id)),
        requesterId: z.string().min(1).max(32).refine(async (id) => await User.checkIfExists(id)),
        requestResponseBy: z.string().min(1).max(100).nullable(),
        objectToAdd: z.union([z.string().min(1).max(100), z.object({
            id: z.number().int().positive(),
            linkType: z.enum(LinkedAssetLinkType),
        })]).nullable(),
        requestType: z.enum(RequestType),
        accepted: z.boolean().nullable(),
        resolvedBy: z.string().min(1).max(32).nullable().refine(async (id) => {
            if (id === null) return true; // If resolvedBy is null, no need
            return await User.checkIfExists(id);
        }),
        messages: z.array(z.object({
            userId: z.string().min(1).max(32).refine(async (id) => await User.checkIfExists(id)),
            message: z.string().max(1024),
            timestamp: z.date(),
        })).default([]),
        createdAt: z.date(),
        updatedAt: z.date(),
        deletedAt: z.date().nullable().optional(),
    }).refine((data) => {
        // Ensure that if the requestType is Report, objectToAdd must be null
        return data.requestType === RequestType.Report && data.objectToAdd !== null
    }, {
        message: `If requestType is Report, objectToAdd must be null`,
    }).refine((data) => {
        // Ensure that if the requestType is Credit or Link, objectToAdd must be a string or LinkedAsset
        if (data.requestType === RequestType.Credit) {
            return typeof data.objectToAdd === 'string'
        } else if (data.requestType === RequestType.Link) {
            if (data.objectToAdd === null) return false; // If requestType is Link, objectToAdd must not be null
            return typeof data.objectToAdd === 'object' && 'id' in data.objectToAdd && 'linkType' in data.objectToAdd;
        }
    }, {
        message: `If requestType is Credit or Link, objectToAdd must be a string or LinkedAsset`,
    }).refine((data) => {
        // Ensure that if the requestType is Report, requestResponseBy must be null
        return data.requestType !== RequestType.Report || data.requestResponseBy === null
    }, {
        message: `If requestType is Report, requestResponseBy must be null`
    }).refine((data) => {
            // Ensure that if the requestType is Credit or Link, requestResponseBy must not be null;
        return data.requestType !== RequestType.Credit && data.requestType !== RequestType.Link || data.requestResponseBy !== null
    }, {
        message: `If requestType is Credit or Link, requestResponseBy must not be null`,
    });
  

    public static createValidator = z.object({
        ...AssetRequest.validator.shape,
        id: AssetRequest.validator.shape.id.nullish(), // id is optional when creating a new request

        accepted: AssetRequest.validator.shape.accepted.nullish(),
        resolvedBy: AssetRequest.validator.shape.resolvedBy.nullish(),
        messages: AssetRequest.validator.shape.messages.nullish(),
        createdAt: AssetRequest.validator.shape.createdAt.nullish(),
        updatedAt: AssetRequest.validator.shape.updatedAt.nullish(),
        deletedAt: AssetRequest.validator.shape.deletedAt.nullish(),
    });

    // #endregion Validators
    public allowedToMessage(user: User): boolean {
        if (this.requestType === RequestType.Report) {
            return this.requesterId === user.id || user.roles.includes(UserRole.Admin) || user.roles.includes(UserRole.Moderator);
        } else {
            return false; // Non-report requests should not allow messaging
        }
    }


    public allowedToAccept(user: User): boolean {
        if (this.requestType === RequestType.Report) {
            return user.roles.includes(UserRole.Admin) || user.roles.includes(UserRole.Moderator);
        } else {
            return user.id === this.requestResponseBy || user.roles.includes(UserRole.Admin) || user.roles.includes(UserRole.Moderator);
        }
    }

    public addMessage(user: User, message: string): Promise<this> {
        Logger.log(`Adding message to request ${this.id} from user ${user.id}`);
        this.messages = [
            ...this.messages,
            {
                userId: user.id,
                message: message,
                timestamp: new Date(Date.now()),
            }
        ]
        return this.save();
    }

    public alertReporter(data: {
        type: AlertType;
        header: string;
        message: string;
    }): Promise<Alert> {
        return User.createAlert(this.requesterId, {
            ...data,
            requestId: this.id,
        });
    }

    public async accept(userId: string, silent = false): Promise<this> {
        let refrencedAsset = await this.refrencedAsset;
        if (!refrencedAsset) {
            throw new Error(`Referenced asset not found.`);
        }
        switch (this.requestType) {
            case RequestType.Credit:
                refrencedAsset.collaborators = [
                    ...refrencedAsset.collaborators,
                    this.objectToAdd as string
                ];
                await refrencedAsset.save();
                break;
            case RequestType.Link:
                let obj = this.objectToAdd as LinkedAsset;
                let otherAsset = await Asset.findByPk(obj.id);
                if (!otherAsset) {
                    throw new Error(`Linked asset not found.`);
                }
                refrencedAsset.addLink(otherAsset, obj.linkType);
                break;
            case RequestType.Report:
                refrencedAsset.setStatus(Status.Rejected, `Report ID ${this.id}`, userId, false);
                if (!silent) {
                    refrencedAsset.alertUploader({
                        type: AlertType.AssetRemoval,
                        header: `Your asset ${refrencedAsset.id} (${refrencedAsset.name}) has been removed.`,
                        message: `Your asset has been removed due to a report. Please do not re-upload the asset. If you have any question, please contact the approval team.`
                    });
                    this.alertReporter({
                        type: AlertType.RequestAccepted,
                        header: `Your report has been accepted`,
                        message: `Your report has been accepted and the asset has been removed. If you have any question, please contact the approval team.`
                    });
                }
                break;
        }

        this.accepted = true;
        this.resolvedBy = userId;
        Logger.log(`Request ${this.id} accepted by user ${userId}`);
        return this.save();
    }

    public decline(userId: string, silent = false): Promise<this> {
        this.accepted = false;
        this.resolvedBy = userId;
        if (!silent) {
            this.alertReporter({
                type: AlertType.RequestDeclined,
                header: `Your request has been declined`,
                message: `Your request has been declined. If you have any question, please contact the approval team.`
            });
        }
        Logger.log(`Request ${this.id} declined by user ${userId}`);
        return this.save();
    }

    public async getAPIResponse(): Promise<AssetRequestPublicAPIv3> {
        let requester = await User.findByPk(this.requesterId);
        let refrencedAsset = await this.refrencedAsset;
        return {
            id: this.id,
            refrencedAssetId: this.refrencedAssetId,
            refrencedAsset: await refrencedAsset?.getApiResponse() || null,
            requesterId: this.requesterId,
            requester: requester?.getApiResponse() || null,
            requestResponseBy: this.requestResponseBy,
            requestType: this.requestType,
            messages: this.messages,
            accepted: this.accepted,
            resolvedBy: this.resolvedBy,
            createdAt: this.createdAt,
            updatedAt: this.updatedAt
        };
    }
}