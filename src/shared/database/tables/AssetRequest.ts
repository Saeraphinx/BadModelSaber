import { InferAttributes, Model, InferCreationAttributes, CreationOptional, NonAttribute } from "sequelize";
import { z } from "zod/v4";
import { AlertType, AssetRequestPublicAPIv3, LinkedAsset, RequestMessage, RequestType, Status, UserRole } from "../DBExtras.ts";
import { User } from "./User.ts";
import { Asset } from "./Asset.ts";
import { Alert } from "./Alert.ts";

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
        refrencedAsset: z.number().int().min(1),
        requesterId: z.string().min(1).max(100),
        requestResponseBy: z.string().min(1).max(100).nullable(),
        requestType: z.enum(RequestType),
        reason: z.string().min(1).max(4096),
        accepted: z.boolean().nullable(),
        acceptReason: z.string().max(320).nullable().default(`No reason provided.`),
        createdAt: z.date(),
        updatedAt: z.date(),
        deletedAt: z.date().nullable(),
    }).refine((data) => {
        if (data.requestType === RequestType.Report) {
            if (data.requestResponseBy !== null) {
                return false; // Report requests should not have a specific user to respond to
            }
        };
        if (data.requestType !== RequestType.Report && data.requestResponseBy === null) {
            return false; // Non-report requests should have a specific user to respond to
        }
        return true;
    });

    public static createValidator = z.object({
        ...AssetRequest.validator.shape,
        id: AssetRequest.validator.shape.id.nullable(), // id is optional when creating a new request
        accepted: AssetRequest.validator.shape.accepted.nullable(),
        acceptReason: AssetRequest.validator.shape.acceptReason.nullable(),
        createdAt: AssetRequest.validator.shape.createdAt.nullable(),
        updatedAt: AssetRequest.validator.shape.updatedAt.nullable(),
        deletedAt: AssetRequest.validator.shape.deletedAt.nullable(),
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
        return this.save();
    }

    public getAPIResponse(): AssetRequestPublicAPIv3 {
        return {
            id: this.id,
            refrencedAssetId: this.refrencedAssetId,
            requesterId: this.requesterId,
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