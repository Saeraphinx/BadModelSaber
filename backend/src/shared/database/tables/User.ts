import { AfterValidate, AllowNull, Column, CreatedAt, DataType, DeletedAt, Model, Table, Unique, UpdatedAt } from "sequelize-typescript";
import { CreationAttributes, CreationOptional, InferAttributes, InferCreationAttributes, Sequelize } from "sequelize";
import { AlertType, UserPlatform, UserApiV3, UserPermissions, PlatformType, UserPublicApiV2, dbId, userPermissionsSchema, userPlatformSchema, Status } from "../DBExtras.ts";
import { Alert } from "./Alert.ts";
import { Logger } from "../../Logger.ts";
import z from "zod";
import { Literal } from "sequelize/lib/utils";
import { parseErrorMessage } from "../../Tools.ts";

export const DefaultPermissions = [UserPermissions.Asset_Create, UserPermissions.Mods_Create, UserPermissions.Users_EditSelf];
export const DefaultPermissionsObject = {
    sitewide: DefaultPermissions,
    perGame: {},
} as const;
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
        type: DataType.INTEGER,
        allowNull: false,
        primaryKey: true,
        defaultValue: Sequelize.literal(`nextval('global_id_seq')`),
    })
    declare id: CreationOptional<number>;

    @AllowNull(true)
    @Unique
    @Column(DataType.STRING(32))

    declare discordId: string | null;
    @AllowNull(true)
    @Unique
    @Column(DataType.STRING(32))
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
        defaultValue: { sitewide: [], perGame: {} },
    })
    declare permissions: CreationOptional<{
        perGame: Record<string, UserPermissions[]>,
        sitewide: UserPermissions[]
    }>;

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
        permissions: z.object({
            perGame: z.record(z.string(), z.array(z.enum(UserPermissions))),
            sitewide: z.array(z.enum(UserPermissions))
        }),
        createdAt: z.date(),
        updatedAt: z.date(),
        deletedAt: z.date().nullable()
    }) satisfies z.ZodType<UserInfer>;

    public static validatorCreation = z.object({
        ...User.validator.shape,
        id: z.union([User.validator.shape.id, z.instanceof(Literal)]).nullish(),
        discordId: User.validator.shape.discordId.nullish(),
        githubId: User.validator.shape.githubId.nullish(),
        displayName: User.validator.shape.displayName.nullish(),
        bio: User.validator.shape.bio.nullish(),
        avatarUrl: User.validator.shape.avatarUrl.nullish(),
        userPlatforms: User.validator.shape.userPlatforms.nullish(),
        permissions: User.validator.shape.permissions.nullish(),
        createdAt: User.validator.shape.createdAt.nullish(),
        updatedAt: User.validator.shape.updatedAt.nullish(),
        deletedAt: User.validator.shape.deletedAt.nullish(),
    });

    public static validateExtended(data: User | UserInfer): string | null {
        //if (!data.githubId && !data.discordId && data.id >= 10) return `User must have at least one of discordId or githubId`;

        // no cos roles in pergame perms
        for (const game in data.permissions.perGame) {
            if (data.permissions.perGame[game].some(r => r.startsWith(`cos_`))) {
                return `Cosmetic roles cannot be assigned as per-game permissions (game: ${game})`;
            }
        }

        if (data.permissions.sitewide.includes(UserPermissions.C_Banned)){
           let hasOtherRoles = Object.values(data.permissions.perGame).some(perms => perms.length > 0) || data.permissions.sitewide.some(perm => perm !== UserPermissions.C_Banned);
           if (hasOtherRoles) return `User with C_Banned role cannot have any other roles`
        };
        return null;
    }

    @AfterValidate
    private static async runValidators(user: User) {
        if (user.isNewRecord) {
            await User.validatorCreation.parseAsync(user).catch(err => {
                Logger.warn(`DB Validator failed - ${parseErrorMessage(err)}`);
                throw err
            });
        } else {
            await User.validator.parseAsync(user).catch(err => {
                Logger.warn(`DB Validator failed - ${parseErrorMessage(err)}`);
                throw err
            });
        }
        let isNotValid = User.validateExtended(user);
        if (isNotValid) {
            throw new Error(isNotValid);
        }
    }
    // #endregion
    // #region getAllowedStatuses
    public static getAllowedStatuses(user?: User | null, gameName?: string): Status[] {
        if (user) {
            return user.getAllowedStatuses(`asset`, gameName);
        } else {
            return [Status.Verified, Status.Unverified];
        }
    }

    public getAllowedStatuses(type: `asset` | `mod`, gameName?: string): Status[] {
        if (type === `asset`) {
            if (!this.checkRoles([UserPermissions.Asset_ViewAll], gameName)) {
                return User.getAllowedStatuses();
            }
        } else {
            if (!this.checkRoles([UserPermissions.Mods_ViewAll], gameName)) {
                return User.getAllowedStatuses();
            }
        }
        return Object.values(Status);
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
    public checkRoles(has: UserPermissions[], gameName?: string): boolean;
    public checkRoles(roles: {
        hasAllOf?: UserPermissions[],
        hasOneOf?: UserPermissions[],
        denied?: UserPermissions[]
    }, gameName?: string): boolean;
    public checkRoles(roles: UserPermissions[] | { hasAllOf?: UserPermissions[], hasOneOf?: UserPermissions[], denied?: UserPermissions[] }, gameName?: string): boolean {
        if (Array.isArray(roles)) {
            if (gameName) {
                return roles.every(role => (this.permissions.sitewide.includes(role) || (this.permissions.perGame[gameName] && this.permissions.perGame[gameName].includes(role))));
            } else {
                return roles.every(role => this.permissions.sitewide.includes(role));
            }
        } else {
            const sitewideCheck = (roles.hasAllOf ? roles.hasAllOf.every(role => this.permissions.sitewide.includes(role)) : true) &&
                (roles.hasOneOf ? roles.hasOneOf.some(role => this.permissions.sitewide.includes(role)) : true) &&
                (roles.denied ? roles.denied.every(role => !this.permissions.sitewide.includes(role)) : true);

            if (gameName) {
                const perGameCheck = (roles.hasAllOf ? roles.hasAllOf.every(role => this.permissions.perGame[gameName]?.includes(role) ?? false) : true) &&
                    (roles.hasOneOf ? roles.hasOneOf.some(role => this.permissions.perGame[gameName]?.includes(role) ?? false) : true) &&
                    (roles.denied ? roles.denied.every(role => !(this.permissions.perGame[gameName]?.includes(role) ?? false)) : true);
                return sitewideCheck && perGameCheck;
            } else {
                return sitewideCheck;
            }
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