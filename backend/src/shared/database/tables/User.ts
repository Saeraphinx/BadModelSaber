import { AfterValidate, Column, CreatedAt, DataType, DeletedAt, Model, Table, UpdatedAt } from "sequelize-typescript";
import { CreationAttributes, CreationOptional, InferAttributes, InferCreationAttributes, Sequelize } from "sequelize";
import { AlertType, UserPlatform, UserApiV3, UserPermissions, PlatformType, UserPublicApiV2, dbId, userPermissionsSchema, userPlatformSchema } from "../DBExtras.ts";
import { Alert } from "./Alert.ts";
import { Logger } from "../../Logger.ts";
import z from "zod";

export type UserEditable = Pick<InferAttributes<User>, "displayName" | "bio">
export type UserInfer = InferAttributes<User>;
@Table({
    tableName: `users`,
    modelName: `User`,
    timestamps: true,
    paranoid: true,
})
export class User extends Model<InferAttributes<User>, InferCreationAttributes<User>> {
    // #region Columns
    @Column({
        type: DataType.NUMBER,
        allowNull: false,
        primaryKey: true,
        autoIncrement: true,
        autoIncrementIdentity: true,
        defaultValue: Sequelize.fn(`nextval`, Sequelize.literal(`'global_id_seq'`)),
    })
    declare id: number;

    @Column({
        type: DataType.STRING(32),
        allowNull: true,
        unique: true,
    })
    declare discordId: string | null;
    @Column({
        type: DataType.STRING(32),
        allowNull: true,
        unique: true,
    })
    declare githubId: string | null;

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
    declare displayName: CreationOptional<string>;
    @Column({
        type: DataType.TEXT,
        allowNull: false,
        defaultValue: "",
    })
    declare bio: CreationOptional<string>;
    @Column({
        type: DataType.JSONB,
        allowNull: true,
        defaultValue: [],
    })
    declare userPlatforms: CreationOptional<UserPlatform[]>;
    @Column({
        type: DataType.STRING,
        allowNull: false,
        defaultValue: "https://cdn.discordapp.com/embed/avatars/0.png",
    })
    declare avatarUrl: CreationOptional<string>;

    @Column({
        type: DataType.JSONB,
        allowNull: false,
        defaultValue: []
    })
    declare permissions: CreationOptional<UserPermissions[]>;

    @CreatedAt
    declare readonly createdAt: CreationOptional<Date>;
    @UpdatedAt
    declare readonly updatedAt: CreationOptional<Date>;
    @DeletedAt
    declare readonly deletedAt: CreationOptional<Date> | null;
    // #endregion

    // #region Validators
    public static validator = z.object({
        id: dbId,
        discordId: z.string().max(32).nullable(),
        githubId: z.string().max(32).nullable(),
        username: z.string().max(255),
        displayName: z.string().max(255),
        bio: z.string(),
        userPlatforms: z.array(userPlatformSchema),
        avatarUrl: z.url(),
        permissions: z.array(userPermissionsSchema),
        createdAt: z.date(),
        updatedAt: z.date(),
        deletedAt: z.date().nullable()
    }) satisfies z.ZodType<UserInfer>;

    public static validatorCreation = z.object({
        ...User.validator.shape,
        id: User.validator.shape.id.nullish(),
        discordId: User.validator.shape.discordId.nullish(),
        githubId: User.validator.shape.githubId.nullish(),
        displayName: User.validator.shape.displayName.nullish(),
        bio: User.validator.shape.bio.nullish(),
        userPlatforms: User.validator.shape.userPlatforms.nullish(),
        permissions: User.validator.shape.permissions.nullish(),
        createdAt: User.validator.shape.createdAt.nullish(),
        updatedAt: User.validator.shape.updatedAt.nullish(),
        deletedAt: User.validator.shape.deletedAt.nullish(),
    });

    public static validateExtended(data: User | UserInfer): string | null {
        if (!data.githubId && !data.discordId) return `User must have at least one of discordId or githubId`;
        return null;
    }

    @AfterValidate
    private static async runValidators(user: User) {
        if (user.isNewRecord) {
            await User.validatorCreation.parseAsync(user);
        } else {
            await User.validator.parseAsync(user);
        }
        let isNotValid = User.validateExtended(user);
        if (isNotValid) {
            throw new Error(isNotValid);
        }
    }
    // #endregion

    // #region createAlert
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

    public static createAlert(userId: number, data: {
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
    // #endregion

    // #region checkRoles
    public checkRoles(has: UserPermissions[]): boolean;
    public checkRoles(roles: {
        hasAllOf?: UserPermissions[],
        hasOneOf?: UserPermissions[],
        denied?: UserPermissions[]
    }): boolean;
    public checkRoles(roles: UserPermissions[] | { hasAllOf?: UserPermissions[], hasOneOf?: UserPermissions[], denied?: UserPermissions[] }): boolean {
        if (Array.isArray(roles)) {
            return roles.every(role => this.permissions.includes(role));
        } else {
            return (roles.hasAllOf ? roles.hasAllOf.every(role => this.permissions.includes(role)) : true) &&
                (roles.hasOneOf ? roles.hasOneOf.some(role => this.permissions.includes(role)) : true) &&
                (roles.denied ? roles.denied.every(role => !this.permissions.includes(role)) : true);
        }
    }
    // #endregion
    public static async checkIfExists(id: number): Promise<boolean> {
        return await User.findByPk(id, { attributes: ['id'] }) ? true : false;
    }

    public toApiV3(): UserApiV3 {
        return {
            id: this.id,
            username: this.username,
            userPlatforms: this.userPlatforms,
            displayName: this.displayName ?? this.username,
            permissions: this.permissions,
            bio: this.bio,
            avatarUrl: this.avatarUrl
        };
    }
    public toApiV2(): UserPublicApiV2 {
        return {
            id: this.id,
            username: this.username,
            githubId: null,
            sponsorUrl: this.userPlatforms.length > 0 ? this.userPlatforms[0].url : null,
            displayName: this.displayName ?? this.username,
            roles: {
                sitewide: [],
                perGame: {},
            },
            bio: this.bio,
            createdAt: this.createdAt,
            updatedAt: this.updatedAt,
        };
    }
}