import { CreationOptional, InferAttributes, InferCreationAttributes, Model } from "sequelize";
import { AlertType, SponserUrl, UserPublicAPIv3, UserRole } from "../DBExtras.ts";
import { Alert } from "./Alert.ts";

export type UserInfer = InferAttributes<User>;
export class User extends Model<InferAttributes<User>, InferCreationAttributes<User>>{
    declare id: string;
    declare username: string;
    declare displayName: string;
    declare bio: CreationOptional<string>;
    declare sponsorUrl: CreationOptional<SponserUrl[] | null>;
    declare avatarUrl: string;

    declare roles: CreationOptional<UserRole[]>;


    declare readonly createdAt: CreationOptional<Date>;
    declare readonly updatedAt: CreationOptional<Date>;
    declare readonly deletedAt: CreationOptional<Date> | null;

    public createAlert(options: {
        type: AlertType;
        assetId?: number | null;
        requestId?: number | null;
        header: string;
        message: string;
    }): Promise<Alert> {
        return Alert.create({
            type: options.type,
            userId: this.id,
            assetId: options.assetId ?? null,
            requestId: options.requestId ?? null,
            header: options.header,
            message: options.message,
            read: false,
            discordMessageSent: true
        });
    }

    public static async checkIfExists(id: string): Promise<boolean> {
        return await User.findByPk(id, {attributes: ['id']}) ? true : false;
    }

    public getApiResponse(): UserPublicAPIv3 {
        return {
            id: this.id,
            username: this.username,
            displayName: this.displayName,
            bio: this.bio,
            sponsorUrl: this.sponsorUrl,
            avatarUrl: this.avatarUrl,
            roles: this.roles
        };
    }
}