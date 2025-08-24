import { Column, CreatedAt, DataType, DeletedAt, Model, Table, UpdatedAt } from "sequelize-typescript";
import { CreationOptional, InferAttributes, InferCreationAttributes } from "sequelize";
import { AlertType, SponserUrl, UserPublicAPIv3, UserRole } from "../DBExtras.ts";
import { Alert } from "./Alert.ts";
import { Logger } from "../../Logger.ts";
import { Col } from "sequelize/lib/utils";

export type UserInfer = InferAttributes<User>;
@Table({
    tableName: `users`,
    modelName: `User`,
    timestamps: true,
    paranoid: true,
})
export class User extends Model<InferAttributes<User>, InferCreationAttributes<User>>{
    @Column({
        type: DataType.STRING(32),
        allowNull: false,
        primaryKey: true,
    })
    declare id: string;
    @Column({
        type: DataType.STRING,
        allowNull: false,
    })
    declare username: string;
    @Column({
        type: DataType.STRING,
        allowNull: false,
        defaultValue: "",
    })
    declare displayName: string;
    @Column({
        type: DataType.TEXT,
        allowNull: false,
        defaultValue: "",
    })
    declare bio: CreationOptional<string>;
    @Column({
        type: DataType.JSONB,
        allowNull: true,
        defaultValue: null,
    })
    declare sponsorUrl: CreationOptional<SponserUrl[] | null>;
    @Column({
        type: DataType.STRING,
        allowNull: false,
        defaultValue: "https://cdn.discordapp.com/embed/avatars/0.png",
    })
    declare avatarUrl: string;

    @Column({
        type: DataType.ARRAY(DataType.STRING),
        allowNull: false,
        defaultValue: [],
    })
    declare roles: CreationOptional<UserRole[]>;

    @CreatedAt
    declare readonly createdAt: CreationOptional<Date>;
    @UpdatedAt
    declare readonly updatedAt: CreationOptional<Date>;
    @DeletedAt
    declare readonly deletedAt: CreationOptional<Date> | null;

    public createAlert(data: {
        type: AlertType;
        assetId?: number | null;
        requestId?: number | null;
        header: string;
        message: string;
    }): Promise<Alert> {
        return User.createAlert(this.id, {
            ...data,
        });
    }

    public static createAlert(userId:string, data: {
        type: AlertType;
        assetId?: number | null;
        requestId?: number | null;
        header: string;
        message: string;
    }): Promise<Alert> {
        Logger.debug(`Creating alert for user ${userId}: ${data.header}`);
        return Alert.create({
            ...data,
            userId: userId,
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