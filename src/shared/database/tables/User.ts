import { CreationOptional, InferAttributes, InferCreationAttributes, Model } from "sequelize";
import { UserPublicAPI } from "../DBExtras.ts";

export type UserInfer = InferAttributes<User>;
export class User extends Model<InferAttributes<User>, InferCreationAttributes<User>>{
    declare id: string;
    declare username: string;
    declare displayName: string;
    declare bio: CreationOptional<string>;
    declare sponsorUrl: CreationOptional<string | null>;
    declare avatarUrl: string;

    declare roles: CreationOptional<UserRole[]>;


    declare readonly createdAt: CreationOptional<Date>;
    declare readonly updatedAt: CreationOptional<Date>;
    declare readonly deletedAt: CreationOptional<Date> | null;

    public static async checkIfExists(id: string): Promise<boolean> {
        return await User.findByPk(id, {attributes: ['id']}) ? true : false;
    }

    public getApiResponse(): UserPublicAPI {
        return {
            id: this.id,
            username: this.username,
            displayName: this.displayName,
            bio: this.bio,
            sponsorUrl: this.sponsorUrl,
            roles: this.roles
        };
    }
}

export enum UserRole {
    Admin = "admin", // Admins have permission to manage users & potentially other sensitive operations
    Developer = "developer", // Developers are able to view everything for development purposes.
    Moderator = "moderator", // Moderators can approve & delete assets
    Trusted = "trusted", // This role has no special permissions at this point in time.
    BSMG = "bsmg", // This role is for BSMG staff, and has no special permissions at this point in time.
    Banned = "banned", // Banned users cannot create assets, comment, or upload files. 
}

