import { CreationOptional, InferAttributes, InferCreationAttributes, NonAttribute, Op, WhereOptions } from "sequelize";
import { AfterCreate, AfterUpdate, AfterValidate, AllowNull, BeforeCreate, BeforeValidate, BelongsTo, BelongsToMany, Column, CreatedAt, DataType, Default, DeletedAt, ForeignKey, Model, Sequelize, Table, UpdatedAt } from "sequelize-typescript";
import { AlertType, ContentHash, ContentHashSchema, Dependency, DependencySchema, ModApiV1, ModVersionsApiv2, Status, StatusHistory, statusHistorySchema, UserPermissions, VersionApiV3, WebhookLogType } from "../DBExtras.ts";
import { SemVer, parse } from "semver";
import { Project } from "./Project.ts";
import { User } from "./User.ts";
import z from "zod/v4";
import { Logger } from "../../Logger.ts";
import { GameVersion } from "./GameVersion.ts";
import { VersionGameVersion } from "./Junctions.ts";
import { Literal } from "sequelize/lib/utils";
import { EnvConfig } from "../../EnvConfig.ts";
import path from "path";
import JSZip from "jszip";
import fs from "fs";
import { decompile } from "@umbranoxio/difflux";
import { WebhookPayloadGenerator, Webhooks } from "../../Webhooks.ts";
import { Alert, AlertInfer, AlertTemplates } from "./Alert.ts";

export type VersionInfer = InferAttributes<Version>;
export type VersionAllowedEdit = Partial<Pick<Version, `semver` | `dependencies`>> & {
    supportedGameVersionIds?: number[];
};
export type VersionWhereOptions = WhereOptions<Version>;
@Table({
    tableName: `versions`,
    modelName: `Version`,
    timestamps: true,
    paranoid: true,
})
export class Version extends Model<InferAttributes<Version>, InferCreationAttributes<Version>> {
    // #region Columns
    @Column({
        type: DataType.INTEGER,
        allowNull: false,
        primaryKey: true,
        defaultValue: Sequelize.literal(`nextval('global_id_seq')`),
    })
    declare readonly id: CreationOptional<number>;

    @AllowNull(false)
    @ForeignKey(() => Project)
    @Column(DataType.INTEGER)
    declare projectId: number;
    @BelongsTo(() => Project, `projectId`)
    declare _project: NonAttribute<Promise<Project | null>>;

    @AllowNull(false)
    @ForeignKey(() => User)
    @Column(DataType.INTEGER)
    declare uploaderId: number;
    @BelongsTo(() => User, `uploaderId`)
    declare _uploader: NonAttribute<Promise<User | null>>;

    @Column({
        type: DataType.STRING,
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

    /**
     * Uses `$set`, `$get`, `$add` functions fpr editing, see https://github.com/sequelize/sequelize-typescript?tab=readme-ov-file#type-safe-usage-of-auto-generated-functions
     *
     * @type {NonAttribute<GameVersion[]>}
     * @memberof Version
     */
    @BelongsToMany(() => GameVersion, () => VersionGameVersion)
    declare supportedGameVersions: NonAttribute<GameVersion[]>;

    @AllowNull(false)
    @Column(DataType.STRING)
    declare status: CreationOptional<Status>;

    @AllowNull(false)
    @Column(DataType.ARRAY(DataType.JSONB))
    declare dependencies: Dependency[];

    @AllowNull(false)
    @Column(DataType.STRING)
    declare platform: string; // pulled from the parent Game's platforms

    @AllowNull(false)
    @Column(DataType.STRING)
    declare zipHash: string;

    @AllowNull(false)
    @Column(DataType.ARRAY(DataType.JSONB))
    declare contentHashes: ContentHash[];

    @AllowNull(true)
    @Default(null)
    @Column(DataType.INTEGER)
    declare lastApprovedById: CreationOptional<number> | null;

    @AllowNull(false)
    @Column(DataType.INTEGER)
    declare lastUpdatedById: number;

    @AllowNull(false)
    @Column(DataType.INTEGER)
    declare fileSize: number;

    @AllowNull(false)
    @Column(DataType.STRING)
    declare baseFileName: CreationOptional<string>

    @AllowNull(false)
    @Default([])
    @Column(DataType.ARRAY(DataType.JSONB))
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
            this._uploader = User.findByPk(this.uploaderId) || null;
            return this._uploader;
        }
    }

    get project(): NonAttribute<Promise<Project | null>> {
        if (this._project) {
            return Promise.resolve(this._project) || null;
        } else {
            Logger.debug(`Project not loaded, fetching from DB for projectId: ${this.projectId}`);
            this._project = Project.findByPk(this.projectId, {
                include: [{ all: true }],
            }) || null;
            return this._project;
        }
    }

    get downloadUrl(): NonAttribute<string> {
        return `${EnvConfig.server.backendUrl}${EnvConfig.server.fileRoute}/${this.projectId}/${this.id}/${this.zipFileName}`;
    }
    
    get versionFolderPath(): NonAttribute<string> {
        return path.join(EnvConfig.uploadsPath, `${this.projectId}`, `${this.id}`);
    }

    get zipFilePath(): NonAttribute<string> {
        return path.join(this.versionFolderPath, `${this.zipFileName}`);
    }

    get dllFilePath(): NonAttribute<string> {
        return path.join(this.versionFolderPath, `${this.baseFileName}.dll`);
    }

    get zipFileName(): NonAttribute<string> {
        return `${this.baseFileName}.zip`;
    }

    get manifestName(): NonAttribute<string> {
        return `${this.baseFileName}_manifest.json`;
    }
    // #endregion
    // #region Validators & Hooks
    /*
    private static validatorTypeTest1: z.infer<typeof Version.validator> = ({} as Version); // validator has property asset doesn't
    private static validatorTypeTest2: VersionInfer = ({} as z.infer<typeof Version.validator>); // asset has property validator doesn't
    */

    public static validator = z.object({
        id: z.number().int().positive(),
        projectId: z.number(),
        uploaderId: z.number(),
        semver: z.instanceof(SemVer),
        status: z.enum(Status),
        dependencies: z.array(DependencySchema),
        platform: z.string(),
        zipHash: z.string(),
        contentHashes: z.array(ContentHashSchema),
        lastApprovedById: z.number().nullable(),
        lastUpdatedById: z.number(),
        fileSize: z.number(),
        statusHistory: z.array(statusHistorySchema),
        baseFileName: z.string(),
        createdAt: z.date(),
        updatedAt: z.date(),
        deletedAt: z.date().nullable(),
    }) satisfies z.ZodType<VersionInfer>;

    public static validatorCreation = z.object({
        ...Version.validator.shape,
        id: Version.validator.shape.id.or(z.instanceof(Literal)).nullish(),
        lastApprovedById: Version.validator.shape.lastApprovedById.nullish(),
        status: Version.validator.shape.status.nullish(),
        statusHistory: Version.validator.shape.statusHistory.nullish(),
        baseFileName: Version.validator.shape.baseFileName.nullish(),
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



        if (z.enum(parentGame.platforms).safeParse(obj.platform).success === false) {
            Logger.warn(`Version platform '${obj.platform}' is not valid for game '${parentGame.name}'.`);
            return false;
        }

        return true;
    }

    @AfterValidate
    private static async runValidators(version: Version) {
        if (version.isNewRecord) {
            Version.validatorCreation.parse(version);
        } else {
            Version.validator.parse(version);
        }
        let isValid = await Version.validateExtended(version);
        if (!isValid) {
            throw new Error(`Extended validation failed for Version.`);
        }
    }
    @BeforeValidate
    private static async runBeforeValidateOnFirstCreate(version: Version) {
        if (!version.isNewRecord) {
            return;
        }
        version.baseFileName = `${(await version.project)?.name}_${version.platform}_v${version.semver.raw}`;
    }
    // #endregion

    public static async checkIfExists(id: number): Promise<boolean> {
        return (await Version.findByPk(id, { attributes: ['id'] })) ? true : false;
    }
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

        let prjView = await prj.canView(user);
        if (prjView && user) { // this has to be done because a project can be viewable but the version can still be private
            if (user.getAllowedStatuses(`mod`, prj.gameName).includes(this.status)) {
                return true;
            } else {
                if (prj.authors === undefined || prj.authors.length === 0) {
                    return await prj.$get(`authors`).then(authors => {
                        return (authors ?? []).some(author => author.id === user.id);
                    });
                } else {
                    return (prj.authors ?? []).some(author => author.id === user.id);
                }
            }
        } else if (prjView) {
            return User.getAllowedStatuses(user, `mod`, prj.gameName).includes(this.status);
        } else {
            return false
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

        return await prj.canEdit(user);
    }
    // #endregion
    // #region Alerts
    public async createAlert(data: {
        type: AlertType;
        header: string;
        message: string;
    }) {
        return await this.project.then(async (project) => {
            if (!project) {
                Logger.warn(`Could not find parent project for version when creating alert.`);
                return null;
            }
            return await project.createAlertForAuthors({
                type: data.type,
                header: data.header,
                message: data.message,
                versionId: this.id,
            }, true, [this.uploaderId]);
        })
    }
    // #region Getters
    public async getDependencies(gameVersionId?: number): Promise<Version[]> {
        const resolvedGameVersionId = gameVersionId ?? this.supportedGameVersions[0].id;
        if (!resolvedGameVersionId) {
            Logger.warn(`No supported game versions found for dependency resolution in version id ${this.id}`);
            return [];
        }

        let deps: Version[] = [];
        for (let dep of this.dependencies) {
            let project = await Project.findByPk(dep.pId);
            if (!project) {
                Logger.warn(`Could not find project for dependency with id ${dep.pId} in version id ${this.id}`);
                continue;
            }
            let version = await project.getLatestVersion(resolvedGameVersionId, dep.sv);
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
    public async setStatus(newStatus: Status, user: User, reason: string, shouldAlert=true, shouldSendWebhooks = true): Promise<this> {
        if (this.status === newStatus) {
            return this;
        }

        let previousStatus = this.status;
        let newlyVerified = newStatus === Status.Verified && previousStatus !== Status.Verified && this.statusHistory.some(entry => entry.status === Status.Verified) === false;
        let newlyUnverified = newStatus === Status.Unverified && previousStatus !== Status.Unverified && this.statusHistory.some(entry => entry.status === Status.Verified || entry.status === Status.Unverified) === false;
        

        let historyEntry: StatusHistory = {
            status: newStatus,
            userId: user.id,
            timestamp: new Date().toISOString(),
            reason: reason,
        };

        this.status = newStatus;
        this.statusHistory = [...(this.statusHistory || []), historyEntry];

        if (newStatus === Status.Verified) {
            this.lastApprovedById = user.id;
        }

        await this.save();
        if (shouldSendWebhooks) {
            Webhooks.sendWebhookLog((await this.project)?.gameName || `unknown`, WebhookLogType.Text_StatusUpdate, false, WebhookPayloadGenerator.generateStatusPayload(this, user, previousStatus, newStatus, reason));
            Webhooks.sendWebhookLog((await this.project)?.gameName || `unknown`, WebhookLogType.StatusUpdate, false, WebhookPayloadGenerator.generateInternalStatusUpdateEmbedPayload(this, user, previousStatus, newStatus, reason));
            if (newlyVerified) {
                Webhooks.sendWebhookLog((await this.project)?.gameName || `unknown`, WebhookLogType.NewlyVerifiedVersion, false, WebhookPayloadGenerator.generateNewlyVerifiedThingEmbedPayload(this, user));
            } else if (newlyUnverified) {
                Webhooks.sendWebhookLog((await this.project)?.gameName || `unknown`, WebhookLogType.NewlyUnverifiedVersion, false, WebhookPayloadGenerator.generateNewlyVerifiedThingEmbedPayload(this, user));
            }
        }
        if (shouldAlert) {
            if (newlyVerified) {
                await this.createAlert({
                    type: AlertType.ThingVerified,
                    ...AlertTemplates.setFirstVersionApproval(`version`, `${(await this.project)?.name} v${this.semver.raw}`, true),
                });
            } else if (previousStatus === Status.Verified && newStatus !== Status.Verified) {
                await this.createAlert({
                    type: AlertType.ThingRemoval,
                    ...AlertTemplates.verifiedRevoked(`version`, `${(await this.project)?.name} v${this.semver.raw}`, newStatus),
                });
            } else if (newStatus === Status.Removed) {
                await this.createAlert({
                    type: AlertType.ThingRejected,
                    ...AlertTemplates.statusChange(`version`, `${(await this.project)?.name} v${this.semver.raw}`, newStatus),
                });
            }
        }
        Logger.info(`Version id ${this.id} status changed from ${previousStatus} to ${newStatus} by user id ${user.id} for reason: ${reason}`);
        
        return this;
    }

    public async updateVersion(data: VersionAllowedEdit, user: User): Promise<this> {
        if (data.semver) {
            this.semver = data.semver;
        }
        if (data.supportedGameVersionIds) {
            let currentVersionGameVersions = await this.$get(`supportedGameVersions`);
            if (!currentVersionGameVersions) {
                throw new Error(`Current supported game versions not found for version id ${this.id} when trying to update supported game versions.`);
            }
            let desiredGameVersions = await GameVersion.findAll({
                where: {
                    id: data.supportedGameVersionIds,
                }
            });
            if (desiredGameVersions.length !== data.supportedGameVersionIds.length) {
                throw new Error(`Invalid supportedGameVersion Ids provied. Some GameVersions not found.`);
            }
            await this.$set(`supportedGameVersions`, desiredGameVersions);

            // find all of the new game versions that aren't in the old game versions, and add any of their linked versions
            let newGameVersions = desiredGameVersions.filter(id => currentVersionGameVersions.every(current => current.id !== id));
            for (let newGameVersion of newGameVersions) {
                if (newGameVersion.linkedVersionIds && newGameVersion.linkedVersionIds.length > 0) {
                    for (let linkedVersionId of newGameVersion.linkedVersionIds) {
                        // if the linked version isn't already supported by this version and the new game version wasn't already supported, add the linked version to the supported versions
                        if (currentVersionGameVersions.every(current => current.id !== linkedVersionId) && desiredGameVersions.every(desired => desired.id !== linkedVersionId)) {
                            this.$add(`supportedGameVersions`, linkedVersionId);
                        }
                    }
                }
            }
        }
        if (data.dependencies) {
            this.dependencies = data.dependencies;
        }
        this.lastUpdatedById = user.id;
        await this.save();
        Webhooks.sendWebhookLog((await this.project)?.gameName || `unknown`, WebhookLogType.Text_Edited, false, WebhookPayloadGenerator.generateEditedThingPayload(this, user, this.projectId));
        return this;
    }
    // #endregion
    // #region Decompiler
    public async doesDecompiledVersionExist(): Promise<boolean> {
        let decompiledPath = path.join(await this.versionFolderPath, `decompiled`);
        return fs.existsSync(decompiledPath);
    }

    public async dotnetDecompile() {
        let startTime = Date.now();
        if (await this.doesDecompiledVersionExist()) {
            Logger.info(`Decomp already exists for version id ${this.id}, skipping decomp.`);
            return;
        }
        // get dll out of zip
        Logger.debug(`Starting decomp for version id ${this.id}. Extracting dll from zip...`);
        let zipFile = fs.readFileSync(this.zipFilePath);
        let zip = await JSZip.loadAsync(zipFile);
        let zipDllFile: JSZip.JSZipObject | null = null;
        try {
            zip.folder(`Plugins`)?.forEach((relativePath, file) => {
                if (relativePath.endsWith(`.dll`)) {
                    zipDllFile = file;
                    Logger.debug(`Found dll file in zip for version id ${this.id} at path ${relativePath}.`);
                }
            });
        } catch (error) {
            throw new Error(`Failed to read zip file for version id ${this.id}: ${(error as Error).message}`);
        }
        if (!zipDllFile) {
            throw new Error(`Could not find dll file in zip for version id ${this.id}`);
        }
        Logger.debug(`Extracting dll file from zip for version id ${this.id}...`);
        let dllData = await (zipDllFile as JSZip.JSZipObject).async(`nodebuffer`);
        // write dll to file for decompilation & future diffing
        let dllFilePath = this.dllFilePath;
        let dllFile = fs.writeFileSync(dllFilePath, dllData);
        // @ts-expect-error
        dllData = null; // free up memory
        // decompile dll with difflux
        Logger.debug(`Decompiling dll for version id ${this.id} at path ${dllFilePath} (prep ${startTime - Date.now()}ms)...`);
        await decompile({ assemblyPath: dllFilePath }, path.join(this.versionFolderPath, `decompiled`));
        Logger.info(`Decompilation completed for version id ${this.id}. Decompiled files saved to ${path.join(this.versionFolderPath, `decompiled`)}. Total Time: ${(Date.now() - startTime) / 1000}s`);
    }
    // #endregion
    // #region ToAPI
    public async toApiV3(): Promise<VersionApiV3> {
        if (!this.supportedGameVersions) {
            throw new Error(`Supported game versions not loaded for version id ${this.id}`);
        }
        let versions = this.supportedGameVersions.map((gv) => gv.toApiV3());

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
            statusHistory: this.statusHistory,
            baseFileName: this.baseFileName,
            downloadUrl: this.downloadUrl,
            createdAt: this.createdAt,
            updatedAt: this.updatedAt
        };
    }

    public async toApiV2(): Promise<ModVersionsApiv2> {
        if (!this.supportedGameVersions) {
            throw new Error(`Supported game versions not loaded for version id ${this.id}`);
        }

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
            supportedGameVersions: this.supportedGameVersions.map((gv) => gv.toApiV2()),
            downloadCount: 0, // to be implemented later
            statusHistory: this.statusHistory.map((entry) => ({
                status: entry.status,
                reason: entry.reason,
                userId: entry.userId,
                setAt: new Date(entry.timestamp),
            })),
            lastUpdatedById: this.lastUpdatedById,
            lastApprovedById: this.lastApprovedById,
            fileSize: this.fileSize,
            createdAt: this.createdAt,
            updatedAt: this.updatedAt
        };
    }

    public async toApiV1(project: Project, gameVersion: GameVersion, doResolution: boolean = true): Promise<ModApiV1> {
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
                return depVersion.toApiV1(depProject, gameVersion, false);
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
                url: this.downloadUrl, //tbd
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