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
    Admin = "admin",
    Developer = "developer",
    Moderator = "moderator",
    Trusted = "trusted",
    BSMG = "bsmg",
    Banned = "banned",
}

