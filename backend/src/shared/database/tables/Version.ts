import { CreationOptional, InferAttributes, InferCreationAttributes, NonAttribute, Op, WhereOptions } from "sequelize";
import { AllowNull, BelongsTo, Column, CreatedAt, DataType, DeletedAt, ForeignKey, Model, Sequelize, Table, UpdatedAt } from "sequelize-typescript";
import { ContentHash, ContentHashSchema, Dependency, DependencySchema, ModApiV1, ModVersionsApiv2, Status, StatusHistory, StatusHistorySchema, UserPermissions, VersionApiV3 } from "../DBExtras.ts";
import { SemVer, parse } from "semver";
import { Project } from "./Project.ts";
import { User } from "./User.ts";
import z from "zod/v4";
import { Logger } from "../../Logger.ts";
import { GameVersion } from "./GameVersion.ts";

export type VersionInfer = InferAttributes<Version>;
export type VersionAllowedEdit = Partial<Pick<Version, `semver` | `supportedGameVersionIds` | `dependencies`>>;
export type VersionWhereOptions = WhereOptions<Version>;
@Table({
    tableName: `versions`,
    modelName: `Version`,
    timestamps: true,
    paranoid: true,
    hooks: {
        afterValidate: async (version: Version) => {
            if (version.isNewRecord) {
                Version.validatorCreation.parse(version);
            } else {
                Version.validator.parse(version);
            }
            let isValid = await Version.validateExtended(version);
            if (!isValid) {
                throw new Error(`Extended validation failed for Version.`);
            }
        },
        afterCreate: async (version: Version) => {
            for (let gameVersionId of version.supportedGameVersionIds) {
                let gv = await GameVersion.findByPk(gameVersionId);
                if (!gv) {
                    Logger.warn(`Could not find GameVersion with id ${gameVersionId} for Version id ${version.id} after creation.`);
                    continue;
                }
                for (let linkedId of gv.linkedVersionIds) {
                    if (!version.supportedGameVersionIds.includes(linkedId)) {
                        version.supportedGameVersionIds = [...version.supportedGameVersionIds, linkedId];
                    }
                }
            }
            await version.save();
        }
    },
})
export class Version extends Model<InferAttributes<Version>, InferCreationAttributes<Version>> {
    // #region Columns
    @Column({
        type: DataType.INTEGER,
        allowNull: false,
        primaryKey: true,
        autoIncrement: true,
        autoIncrementIdentity: true,
        defaultValue: Sequelize.fn(`nextval`, Sequelize.literal(`'global_id_seq'`)),
    })
    declare readonly id: CreationOptional<number>;

    @Column(DataType.INTEGER)
    @AllowNull(false)
    @ForeignKey(() => Project)
    declare projectId: number;
    @BelongsTo(() => Project, `projectId`)
    declare _project: NonAttribute<Promise<Project | null>>;

    @Column(DataType.TEXT)
    @AllowNull(false)
    @ForeignKey(() => User)
    declare uploaderId: number;
    @BelongsTo(() => User, `uploaderId`)
    declare _uploader: NonAttribute<Promise<User | null>>;

    @Column({
        type: DataType.TEXT,
        allowNull: false,
        get() {
            const rawValue = this.getDataValue(`semver`);
            return parse(rawValue, { loose: true }, false);
        },
        set(value: SemVer) {
            this.setDataValue(`semver`, value.raw);
        }
    })
    declare semver: SemVer;

    @Column(DataType.ARRAY(DataType.INTEGER))
    @AllowNull(false)
    declare supportedGameVersionIds: number[]; // ids of GameVersion entries

    @Column(DataType.TEXT)
    @AllowNull(false)
    declare status: Status;

    @Column(DataType.ARRAY(DataType.JSONB))
    @AllowNull(false)
    declare dependencies: Dependency[];

    @Column(DataType.TEXT)
    @AllowNull(false)
    declare platform: string; // pulled from the parent Game's platforms

    @Column(DataType.TEXT)
    @AllowNull(false)
    declare zipHash: string;

    @Column(DataType.ARRAY(DataType.JSONB))
    @AllowNull(false)
    declare contentHashes: ContentHash[];

    @Column(DataType.INTEGER)
    @AllowNull(false)
    declare lastApprovedById: CreationOptional<number> | null;

    @Column(DataType.INTEGER)
    @AllowNull(false)
    declare lastUpdatedById: number;

    @Column(DataType.INTEGER)
    @AllowNull(false)
    declare fileSize: number;

    @Column(DataType.ARRAY(DataType.JSONB))
    @AllowNull(false)
    declare statusHistory: CreationOptional<StatusHistory[]>;

    @CreatedAt
    declare readonly createdAt: CreationOptional<Date>;
    @UpdatedAt
    declare readonly updatedAt: CreationOptional<Date>;
    @DeletedAt
    declare readonly deletedAt: CreationOptional<Date> | null;


    get uploader(): NonAttribute<Promise<User | null>> {
        if (this._uploader) {
            return Promise.resolve(this._uploader) || null;
        } else {
            Logger.debug(`User not loaded, fetching from DB for uploaderId: ${this.uploaderId}`);
            return User.findByPk(this.uploaderId) || null;
        }
    }

    get project(): NonAttribute<Promise<Project | null>> {
        if (this._project) {
            return Promise.resolve(this._project) || null;
        } else {
            Logger.debug(`Project not loaded, fetching from DB for projectId: ${this.projectId}`);
            return Project.findByPk(this.projectId) || null;
        }
    }
    // #endregion
    // #region Validators
    /*
    private static validatorTypeTest1: z.infer<typeof Version.validator> = ({} as Version); // validator has property asset doesn't
    private static validatorTypeTest2: VersionInfer = ({} as z.infer<typeof Version.validator>); // asset has property validator doesn't
    */


    public static validator = z.object({
        id: z.number().int().positive(),
        projectId: z.number(),
        uploaderId: z.number(),
        semver: z.instanceof(SemVer),
        supportedGameVersionIds: z.array(z.number()),
        status: z.enum(Status),
        dependencies: z.array(DependencySchema),
        platform: z.string(),
        zipHash: z.string(),
        contentHashes: z.array(ContentHashSchema),
        lastApprovedById: z.number().nullable(),
        lastUpdatedById: z.number(),
        fileSize: z.number(),
        statusHistory: z.array(StatusHistorySchema),
        createdAt: z.date(),
        updatedAt: z.date(),
        deletedAt: z.date().nullable(),
    }) satisfies z.ZodType<VersionInfer>;

    public static validatorCreation = z.object({
        ...Version.validator.shape,
        id: Version.validator.shape.id.nullish(),
        lastApprovedById: Version.validator.shape.lastApprovedById.nullish(),
        statusHistory: Version.validator.shape.statusHistory.nullish(),
        createdAt: Version.validator.shape.createdAt.nullish(),
        updatedAt: Version.validator.shape.updatedAt.nullish(),
        deletedAt: Version.validator.shape.deletedAt.nullish(),
    });

    public static async validateExtended(obj: Version | VersionInfer): Promise<boolean> {
        // need to load the parent project to validate game compatibility
        let parent = null;
        if (obj instanceof Version) {
            parent = await obj.project;
        } else {
            parent = await Project.findByPk(obj.projectId);
        }
        if (!parent) {
            Logger.warn(`Could not find parent project for version validation.`);
            return false;
        }

        let parentGame = await parent.game
        if (!parentGame) {
            Logger.warn(`Could not find parent game for version validation.`);
            return false;
        }

        let supportedGameVersions = await GameVersion.count({
            where: {
                id: obj.supportedGameVersionIds,
                gameName: parentGame.name,
            }
        });

        if (supportedGameVersions != obj.supportedGameVersionIds.length) {
            Logger.warn(`Not all supported game versions found for version validation.`);
            return false;
        }

        if (z.enum(parentGame.platforms).safeParse(obj.platform).success === false) {
            Logger.warn(`Version platform '${obj.platform}' is not valid for game '${parentGame.name}'.`);
            return false;
        }

        return true;
    }
    // #endregion
    // #region DuplicateChecks
    public static async checkForExistingVersion(projectId: number, semver: SemVer, excludeId?: number): Promise<boolean> {
        let whereClause: VersionWhereOptions = {
            projectId: projectId,
            semver: semver.raw,
            status: {
                [Op.or]: [Status.Verified, Status.Unverified, Status.Pending],
            },
        };
        if (excludeId) {
            (whereClause as any).id = {
                [Op.ne]: excludeId,
            };
        }

        return await Version.count({
            where: whereClause,
        }) > 0;
    }
    // #endregion
    // #region Permissions
    public async canView(user: User | null | undefined, project?: Project): Promise<boolean> {
        let prj: Project | null | undefined = project;
        if (!prj) {
            prj = await this.project;
        }

        if (!prj) {
            Logger.warn(`Could not find parent project for version canView check.`);
            return false;
        }

        let parentViewable = await prj.canView(user);
        if (parentViewable === false) {
            return false;
        }

        if (!user) {
            return false;
        }

        if (this.status === Status.Verified) {
            return true;
        }

        if (this.status === Status.Unverified) {
            return user.checkRoles({
                gameName: prj.gameName,
                perGamePermissions: [UserPermissions.View_Unverified_Mods, UserPermissions.View_All_Mods]
            });
        } else if (this.status === Status.Pending) {
            return user.checkRoles({
                gameName: prj.gameName,
                perGamePermissions: [UserPermissions.View_Pending_Mods, UserPermissions.View_All_Mods]
            });
        } else {
            return user.checkRoles({
                gameName: prj.gameName,
                perGamePermissions: [UserPermissions.View_All_Mods]
            });
        }
    }
    public async canEdit(user: User | null | undefined, project?: Project): Promise<boolean> {
        let prj: Project | null | undefined = project;
        if (!prj) {
            prj = await this.project;
        }
        if (!prj) {
            Logger.warn(`Could not find parent project for version canEdit check.`);
            return false;
        }

        if (!user) {
            return false;
        }

        return prj.canEdit(user);
    }
    // #endregion
    // #region Getters
    public async getDependencies(gameVersionId: number = this.supportedGameVersionIds[0]): Promise<Version[]> {
        let deps: Version[] = [];
        for (let dep of this.dependencies) {
            let project = await Project.findByPk(dep.pId);
            if (!project) {
                Logger.warn(`Could not find project for dependency with id ${dep.pId} in version id ${this.id}`);
                continue;
            }
            let version = await project.getLatestVersion(gameVersionId, dep.sv);
            if (!version) {
                Logger.warn(`Could not find version for dependency with project id ${dep.pId} and semver range ${dep.sv} in version id ${this.id}`);
                continue;
            }
            deps.push(version);
        }
        return deps;
    }
    // #endregion
    // #region Setters
    public async setStatus(newStatus: Status, user: User, reason: string): Promise<this> {
        if (this.status === newStatus) {
            return this;
        }

        let previousStatus = this.status;
        
        let historyEntry: StatusHistory = {
            status: newStatus,
            changedById: user.id,
            changedAt: new Date().toISOString(),
            reason: reason,
        };

        this.status = newStatus;
        this.statusHistory = [...(this.statusHistory || []), historyEntry];

        if (newStatus === Status.Verified) {
            this.lastApprovedById = user.id;
        }

        await this.save();

        Logger.info(`Version id ${this.id} status changed from ${previousStatus} to ${newStatus} by user id ${user.id} for reason: ${reason}`);

        return this;
    }
    // #region ToAPI
    public async toPublicApiV3(): Promise<VersionApiV3> {
        let versions = await GameVersion.findAll({
            where: {
                id: this.supportedGameVersionIds,
            }
        }).then((gvs) => gvs.map((gv) => gv.toPublicApiV3()));

        return {
            id: this.id,
            projectId: this.projectId,
            uploaderId: this.uploaderId,
            semver: this.semver.raw,
            platform: this.platform,
            supportedGameVersions: versions,
            status: this.status,
            dependencies: this.dependencies,
            fileSize: this.fileSize,
            zipHash: this.zipHash,
            contentHashes: this.contentHashes,
            createdAt: this.createdAt,
            updatedAt: this.updatedAt
        };
    }

    public async toPublicApiV2(): Promise<ModVersionsApiv2> {
        let supportedGameVersions = await GameVersion.findAll({
            where: {
                id: this.supportedGameVersionIds,
            }
        });

        let uploader = await this.uploader;
        if (!uploader) {
            throw new Error(`Uploader not found for Version id ${this.id}`);
        }

        return {
            id: this.id,
            modId: this.projectId,
            modVersion: this.semver.raw,
            author: uploader.toApiV2(),
            platform: this.platform,
            zipHash: this.zipHash,
            contentHashes: this.contentHashes,
            status: this.status,
            // fix this later
            dependencies: this.dependencies.map((dep) => dep.pId),
            supportedGameVersions: supportedGameVersions.map((gv) => gv.toPublicApiV2()),
            downloadCount: 0, // to be implemented later
            statusHistory: this.statusHistory.map((entry) => ({
                status: entry.status,
                reason: entry.reason,
                userId: entry.changedById,
                setAt: new Date(entry.changedAt),
            })),
            lastUpdatedById: this.lastUpdatedById,
            lastApprovedById: this.lastApprovedById,
            fileSize: this.fileSize,
            createdAt: this.createdAt,
            updatedAt: this.updatedAt
        };
    }

    public async toPublicApiV1(project: Project, gameVersion: GameVersion, doResolution: boolean = true): Promise<ModApiV1> {
        let dependencyPromises = this.dependencies.map(async (dep) => {
            let depProject = await Project.findByPk(dep.pId);
            if (!depProject) {
                throw new Error(`Could not find project for dependency with id ${dep.pId}`);
            }
            let depVersion = await depProject.getLatestVersion(gameVersion.id, dep.sv);
            if (!depVersion) {
                throw new Error(`Could not find version for dependency with project id ${dep.pId} and semver range ${dep.sv}`);
            }
            if (doResolution) {
                return depVersion.toPublicApiV1(depProject, gameVersion, false);
            } else {
                return depVersion.id.toString();
            }
        });

        let uploader = doResolution ? await this.uploader : null;

        let status: `approved` | `pending` | `declined`;
        switch (this.status) {
            case Status.Private: // this should never happen
                status = `declined`;
                break;
            case Status.Pending:
            case Status.Unverified:
                status = `pending`;
                break;
            case Status.Verified:
                status = `approved`;
                break;
            case Status.Removed:
                status = `declined`;
                break;
            default:
                status = `declined`;
                break;
        }

        let dependencies = doResolution ? await Promise.all(dependencyPromises) as ModApiV1[] : await Promise.all(dependencyPromises) as string[];

        return {
            _id: this.id.toString(),
            name: project.name.toString(),
            version: this.semver.raw,
            gameVersion: gameVersion.version,
            authorId: this.uploaderId.toString(),
            updatedDate: this.updatedAt.toUTCString(),
            uploadDate: this.createdAt.toUTCString(),
            author: doResolution ? {
                _id: uploader!.id.toString(),
                username: uploader!.username.toString(),
                lastLogin: uploader!.updatedAt.toString(),
            } : undefined,
            status: status,
            description: project.summary,
            link: project.gitUrl,
            category: project.category.charAt(0).toUpperCase() + project.category.slice(1),
            downloads: [{
                type: this.platform,
                url: ``, //tbd
                hashMd5: this.contentHashes.map((hash) => {
                    return {
                        hash: hash.hash,
                        file: hash.path
                    };
                })
            }],
            dependencies: dependencies,
            required: project.category === `Core` ? true : false,
        };
    }
    // #endregion
}