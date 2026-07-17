import { AfterValidate, AllowNull, BelongsToMany, Column, CreatedAt, DataType, DeletedAt, Model, Table, Unique, UpdatedAt } from "sequelize-typescript";
import { CreationAttributes, CreationOptional, InferAttributes, InferCreationAttributes, NonAttribute, Op, Sequelize, WhereOptions } from "sequelize";
import { AlertType, UserPlatform, UserApiV3, UserPermissions, PlatformType, UserPublicApiV2, dbId, userPermissionsSchema, userPlatformSchema, Status } from "../DBExtras.ts";
import { Alert } from "./Alert.ts";
import { Logger } from "../../Logger.ts";
import z from "zod";
import { Literal } from "sequelize/lib/utils";
import { parseErrorMessage } from "../../Tools.ts";
import { Asset } from "./Asset.ts";
import { Version } from "./Version.ts";
import { ThingRequest } from "./ThingRequest.ts";
import { Translation } from "./Translation.ts";
import { Project } from "./Project.ts";
import { ProjectAuthor } from "./Junctions.ts";
import sequelize from "sequelize/lib/sequelize";

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

    @Column({
        type: DataType.BOOLEAN,
        allowNull: false,
        defaultValue: false,
    })
    declare shouldDmAlerts: CreationOptional<boolean>;

    @BelongsToMany(() => Project, () => ProjectAuthor)
    declare authoredProjects: NonAttribute<Project[]>;

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
        shouldDmAlerts: z.boolean(),
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
        shouldDmAlerts: User.validator.shape.shouldDmAlerts.nullish(),
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

        if (data.permissions.sitewide.includes(UserPermissions.C_Banned)) {
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
    public static getAllowedStatuses(user?: User | null, type: `asset` | `mod` = `asset`, gameName?: string): Status[] {
        if (user) {
            return user.getAllowedStatuses(type, gameName);
        } else {
            return [Status.Verified, Status.Unverified];
        }
    }

    public getAllowedStatuses(type: `asset` | `mod`, gameName?: string): Status[] {
        if (type === `asset`) {
            if (this.checkRoles([UserPermissions.Asset_ViewAll], gameName)) {
                return Object.values(Status);
            }
        } else {
            if (this.checkRoles([UserPermissions.Mods_ViewAll], gameName)) {
                return Object.values(Status);
            }
        }

        if (this.checkRoles([UserPermissions.Secret_Features])) {
            return [Status.Verified, Status.Unverified, Status.Queue, Status.Testing];
        } else {
            return [Status.Verified, Status.Unverified];
        }
    }

    // #endregion
    // #region createAlert
    public createAlert(data: {
        type: AlertType;
        assetId?: number | null;
        versionId?: number | null;
        projectId?: number | null;
        requestId?: number | null;
        header: string;
        message: string;
    }): Promise<Alert> {
        return User.createAlert(this.id, {
            ...data,
        }, this);
    }

    public static createAlert(userId: number, data: {
        type: AlertType;
        assetId?: number | null;
        versionId?: number | null;
        projectId?: number | null;
        requestId?: number | null;
        header: string;
        message: string;
    }, user?: User): Promise<Alert> {
        Logger.debug(`Creating alert for user ${userId}: ${data.header}`);
        return Alert.create({
            ...data,
            userId: userId,
            read: false,
            discordMessageSent: !(user?.shouldDmAlerts ?? false), // if user doesn't want DMs, we consider the alert "sent" for the purposes of not trying to send a DM
        }).then(alert => {
            Logger.debug(`Created alert ${alert.id} for user ${userId}: '${data.header}'`);
            if (user && user.shouldDmAlerts) {
                Logger.debug(`Sending DM alert to user ${userId} for alert ${alert.id}`);
                // send discord DM
                // we don't await this, because we don't want to block the main thread if discord is having issues
                alert.sendDiscordMessage(user).catch(err => {
                    Logger.warn(`Failed to send Discord DM for alert ${alert.id} to user ${userId}: ${parseErrorMessage(err)}`);
                });
            }
            return alert;
        }).catch(err => {
            Logger.error(`Failed to create alert '${data.header}' for user ${userId}: ${parseErrorMessage(err)}`);
            throw err;
        });
    }
    // #endregion

    // #region checkRoles
    public checkRoles(hasOneOf: UserPermissions[], gameName?: string): boolean;
    public checkRoles(roles: {
        hasAllOf?: UserPermissions[],
        hasOneOf?: UserPermissions[],
        denied?: UserPermissions[]
    }, gameName?: string): boolean;
    public checkRoles(roles: UserPermissions[] | { hasAllOf?: UserPermissions[], hasOneOf?: UserPermissions[], denied?: UserPermissions[] }, gameName?: string): boolean {
        if (Array.isArray(roles)) {
            if (gameName) {
                return roles.some(role => (this.permissions.sitewide.includes(role) || (this.permissions.perGame[gameName] && this.permissions.perGame[gameName].includes(role))));
            } else {
                return roles.some(role => this.permissions.sitewide.includes(role));
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

    public async migrateUserItems(newUser: User) {
        Logger.info(`Migrating items from user ${this.id} to user ${newUser.id}`);
        let migrationPromises = [];

        migrationPromises.push(
            Alert.update({ userId: newUser.id }, { where: { userId: this.id }, hooks: false }),
            Asset.update({ uploaderId: newUser.id }, { where: { uploaderId: this.id }, hooks: false }),
            Asset.update({ collaboratorIds: Sequelize.literal(`array_replace("collaboratorIds", ${this.id}, ${newUser.id})`) }, { where: { collaboratorIds: { [Op.contains]: [this.id] } }, hooks: false }),
            ThingRequest.update({ requesterId: newUser.id }, { where: { requesterId: this.id }, hooks: false }),
            ThingRequest.update({ requestResponseBy: newUser.id }, { where: { requestResponseBy: this.id }, hooks: false }),
            Translation.update({ translatedBy: newUser.id }, { where: { translatedBy: this.id }, hooks: false }),
            (async () => {
                const authoredProjectRows = await ProjectAuthor.findAll({
                    where: { userId: this.id },
                });

                if (authoredProjectRows.length === 0) {
                    return;
                }

                const projectIds = [...new Set(authoredProjectRows.map((row) => row.projectId))];
                const existingNewUserRows = await ProjectAuthor.findAll({
                    where: {
                        userId: newUser.id,
                        projectId: { [Op.in]: projectIds },
                    },
                });
                const existingProjectIds = new Set(existingNewUserRows.map((row) => row.projectId));
                const rowsToCreate = projectIds
                    .filter((projectId) => !existingProjectIds.has(projectId))
                    .map((projectId) => ({
                        projectId,
                        userId: newUser.id,
                    }));

                if (rowsToCreate.length > 0) {
                    await ProjectAuthor.bulkCreate(rowsToCreate as any);
                }

                await ProjectAuthor.destroy({ where: { userId: this.id } });
            })(),
            Project.update({ collaboratorIds: Sequelize.literal(`array_replace("collaboratorIds", ${this.id}, ${newUser.id})`) }, { where: { collaboratorIds: { [Op.contains]: [this.id] } }, hooks: false }),
            Project.update({ lastUpdatedById: newUser.id }, { where: { lastUpdatedById: this.id }, hooks: false }),
            Project.update({ lastApprovedById: newUser.id }, { where: { lastApprovedById: this.id }, hooks: false }),
            Version.update({ uploaderId: newUser.id }, { where: { uploaderId: this.id }, hooks: false }),
            Version.update({ lastApprovedById: newUser.id }, { where: { lastApprovedById: this.id }, hooks: false }),
            Version.update({ lastUpdatedById: newUser.id }, { where: { lastUpdatedById: this.id }, hooks: false }),
            // update statusHistory userIds in Asset and Version
            ThingRequest.findAll().then(requests => {
                return Promise.all(requests.map(async request => {
                    request.messages = request.messages.map(message => {
                        if (message.userId === this.id) {
                            message.userId = newUser.id;
                        }
                        return message;
                    });
                    return request.save({ hooks: false });
                }));
            }),
            Project.findAll().then(projects => {
                return Promise.all(projects.map(async project => {
                    project.statusHistory = project.statusHistory.map(entry => {
                        if (entry.userId === this.id) {
                            entry.userId = newUser.id;
                        }
                        return entry;
                    });
                    return project.save({ hooks: false });
                }));
            }),
            Asset.findAll().then(assets => {
                return Promise.all(assets.map(async asset => {
                    asset.statusHistory = asset.statusHistory.map(entry => {
                        if (entry.userId === this.id) {
                            entry.userId = newUser.id;
                        }
                        return entry;
                    });
                    return asset.save({ hooks: false });
                }));
            }),
            Version.findAll().then(versions => {
                return Promise.all(versions.map(async version => {
                    version.statusHistory = version.statusHistory.map(entry => {
                        if (entry.userId === this.id) {
                            entry.userId = newUser.id;
                        }
                        return entry;
                    });
                    return version.save({ hooks: false });
                }));
            })
        )

        await Promise.all(migrationPromises);
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