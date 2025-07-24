import { InferAttributes, Model, InferCreationAttributes, CreationOptional } from "sequelize";
import { z } from "zod/v4";
import { User } from "./User.ts";
import { Asset } from "./Asset.ts";
import { AlertPublicAPIv3, AlertType } from "../DBExtras.ts";

export type AlertInfer = InferAttributes<Alert>;
export class Alert extends Model<InferAttributes<Alert>, InferCreationAttributes<Alert>> {
    declare id: CreationOptional<number>;
    
    declare type: AlertType; // Type of alert, e.g. "new_asset", "asset_approved", etc.
    declare userId: string; // User ID of the person who should receive the alert

    declare assetId: CreationOptional<number | null>; // Asset ID related to the alert, null if not applicable
    declare requestId: CreationOptional<number | null>; // Request ID related to the alert, null if not applicable

    declare header: string; // Header of the alert, e.g. "New Asset Approved"
    declare message: string; // Message content of the alert
    declare read: CreationOptional<boolean>; // Whether the alert has been read or not
    declare discordMessageSent: CreationOptional<boolean>; // Whether a Discord message has been sent for this alert

    declare createdAt: CreationOptional<Date>; // Timestamp of when the alert was created
    declare updatedAt: CreationOptional<Date>; // Timestamp of when the alert was last updated
    declare deletedAt: CreationOptional<Date | null>; // Timestamp of when the alert was deleted, null

    // #region Validators
    public static validator = z.object({
        // unique by db
        id: z.number().int().positive(),
        type: z.enum(AlertType),
        userId: z.string().refine(async (id) => await User.checkIfExists(id)),
        assetId: z.number().int().refine(async (id) => await Asset.checkIfExists(id)).nullable(),
        requestId: z.number().int().nullable(),
        header: z.string().min(1).max(255),
        message: z.string().min(1).max(4096),
        read: z.boolean(),
        discordMessageSent: z.boolean(),
        createdAt: z.date(),
        updatedAt: z.date(),
        deletedAt: z.date().nullable(),
    }).refine((data) => {
        // Ensure that either assetId or requestId is provided, but not both
        if ((data.assetId === null && data.requestId === null) || (data.assetId !== null && data.requestId !== null)) {
            throw new Error("Either assetId or requestId must be provided, but not both.");
        }
        return true;
    });

    public static createValidator = z.object({
        ...Alert.validator.shape,
        id: Alert.validator.shape.id.nullish(), // id is optional when creating a new alert
        read: Alert.validator.shape.read.nullish(),
        assetId: Alert.validator.shape.assetId.nullish(),
        requestId: Alert.validator.shape.requestId.nullish(),
        discordMessageSent: Alert.validator.shape.discordMessageSent.nullish(),
        createdAt: Alert.validator.shape.createdAt.nullish(),
        updatedAt: Alert.validator.shape.updatedAt.nullish(),
        deletedAt: Alert.validator.shape.deletedAt.nullish(),
    }).refine((data) => {
        // Ensure that either assetId or requestId is provided, but not both
        if ((data.assetId === null && data.requestId === null) || (data.assetId !== null && data.requestId !== null)) {
            throw new Error("Either assetId or requestId must be provided, but not both.");
        }
        return true;
    });
    // #endregion Validators

    public toAPIResponse(): AlertPublicAPIv3 {
        return {
            id: this.id,
            type: this.type,
            assetId: this.assetId,
            requestId: this.requestId,
            header: this.header,
            message: this.message,
            read: this.read,
            createdAt: this.createdAt,
            updatedAt: this.updatedAt,
        }
    }
}