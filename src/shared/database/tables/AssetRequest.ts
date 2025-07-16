import { InferAttributes, Model, InferCreationAttributes, CreationOptional } from "sequelize";
import { z } from "zod/v4";
import { RequestType } from "../DBExtras.ts";

export type AssetRequestInfer = InferAttributes<AssetRequest>;
export class AssetRequest extends Model<InferAttributes<AssetRequest>, InferCreationAttributes<AssetRequest>> {
    declare id: CreationOptional<number>;
    declare refrencedAsset: number; // Asset ID that this request is for
    declare requesterId: string; // User ID of the person who made the request
    declare requestResponseBy: string | null; // User ID of the person who has been asked to respond to the request. null if this isn't for a specific user

    declare requestType: RequestType;
    declare reason: string; // Reason for the request, e.g. "I want to credit this user for this asset" 

    declare accepted: CreationOptional<boolean | null>; // Whether the request has been accepted or not
    declare acceptReason: CreationOptional<string | null>; // Reason for accepting the request, if applicable

    declare createdAt: CreationOptional<Date>; // Timestamp of when the request was created
    declare updatedAt: CreationOptional<Date>; // Timestamp of when the request was last updated
    declare deletedAt: CreationOptional<Date | null>; // Timestamp of when the request was deleted, null if not deleted

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

    public accept(reason: string): void {
        this.accepted = true;
        this.acceptReason = reason;
    }

    public decline(reason: string): void {
        this.accepted = false;
        this.acceptReason = reason;
    }

    public toAPIResponse() {
        return {
            id: this.id,
            refrencedAsset: this.refrencedAsset,
            requesterId: this.requesterId,
            requestResponseBy: this.requestResponseBy,
            requestType: this.requestType,
            reason: this.reason,
            accepted: this.accepted,
            createdAt: this.createdAt,
            updatedAt: this.updatedAt,
            deletedAt: this.deletedAt
        };
    }
}