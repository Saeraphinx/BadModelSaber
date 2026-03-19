import { AfterValidate, AllowNull, BelongsTo, Column, CreatedAt, DataType, Default, DeletedAt, ForeignKey, Model, Table, UpdatedAt } from "sequelize-typescript";
import { col, CreationOptional, InferAttributes, InferCreationAttributes, NonAttribute, Op, Sequelize, WhereOptions } from "sequelize";
import { dbId, ModApiv2, ProjectApiV3, RequestType, Status, StatusHistory, statusHistorySchema, UserPermissions } from "../DBExtras.ts";
import z from "zod/v4";
import { Game } from "./Game.ts";
import { Logger } from "../../Logger.ts";
import { User } from "./User.ts";
import { Version } from "./Version.ts";
import { satisfies } from "semver";
import { Translation } from "./Translation.ts";
import { IReportable, IPermissionsChecks } from "./common.ts";
import { ThingRequest } from "./ThingRequest.ts";
import { Literal } from "sequelize/lib/utils";
import { EnvConfig } from "../../EnvConfig.ts";
import path from "path";


export type ProjectInfer = InferAttributes<Project>;
export type ProjectAllowedEdit = Partial<Pick<Project, `summary` | `description` | `category` | `gitUrl` | `authorIds` | `collaboratorIds`>>;
export type ProjectWhereOptions = WhereOptions<Project>;

@Table({
    tableName: `projects`,
    modelName: `Project`,
    timestamps: true,
    paranoid: true,
})
export class Project extends Model<InferAttributes<Project>, InferCreationAttributes<Project>> implements IPermissionsChecks, IReportable {
    // #region Columns
    @Column({
        type: DataType.INTEGER,
        allowNull: false,
        primaryKey: true,
        defaultValue: Sequelize.literal(`nextval('global_id_seq')`),
    })
    declare readonly id: CreationOptional<number>;

    @AllowNull(false)
    @Column(DataType.TEXT)
    declare name: string; // the name of the project

    @AllowNull(false)
    @Column(DataType.TEXT)
    declare summary: string; // a short summary of the project - for display in lists

    @AllowNull(false)
    @Column(DataType.TEXT)
    declare description: string; // a longer description of the project - for the project details page - think a readme

    @AllowNull(false)
    @ForeignKey(() => Game)
    @Column(DataType.STRING)
    declare gameName: string; // the id of the game that this project is for
    @BelongsTo(() => Game, `gameName`)
    declare _game: NonAttribute<Promise<Game | null>>;

    @AllowNull(false)
    @Column(DataType.STRING)
    declare category: string; // what to categorize this project as

    @AllowNull(false)
    @Column(DataType.ARRAY(DataType.INTEGER))
    declare authorIds: number[]; // the ids of the users who are authors of this project

    @AllowNull(false)
    @Default([])
    @Column(DataType.ARRAY(DataType.INTEGER))
    declare collaboratorIds: number[]; // the ids of the users who are collaborators on this project

    @AllowNull(false)
    @Column(DataType.STRING)
    declare status: Status; // the current status of the project

    @AllowNull(false)
    @Column(DataType.STRING)
    declare iconFileName: string; // the filename of the project's icon image

    @AllowNull(false)
    @Column(DataType.TEXT)
    declare gitUrl: string; // the URL of the project's git repository

    @AllowNull(true)
    @Column(DataType.INTEGER)
    declare lastApprovedById: CreationOptional<number> | null;

    @AllowNull(false)
    @Column(DataType.INTEGER)
    declare lastUpdatedById: number;

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

    get game(): NonAttribute<Promise<Game | null>> {
        if (this._game) {
            return Promise.resolve(this._game) || null;
        } else {
            Logger.debug(`Game not loaded, fetching from DB for gameName: ${this.gameName}`);
            return Game.findByPk(this.gameName) || null;
        }
    }

    get folderPath(): NonAttribute<string> {
        return path.join(EnvConfig.storage.uploads, this.id.toString());
    }
    // #endregion
    // #region Validatiors
    /*
    private static validatorTypeTest1: z.infer<typeof Project.validator> = ({} as Project); // validator has property asset doesn't
    private static validatorTypeTest2: ProjectInfer = ({} as z.infer<typeof Project.validator>); // asset has property validator doesn't
    */

    public static validator = z.object({
        id: dbId,
        name: z.string().max(128),
        summary: z.string().max(256),
        description: z.string().max(4096),
        gameName: z.string(),
        category: z.string(),
        authorIds: z.array(dbId).min(1),
        status: z.enum(Status),
        iconFileName: z.string(),
        gitUrl: z.url(),
        lastApprovedById: dbId.nullable(),
        lastUpdatedById: dbId,
        collaboratorIds: z.array(dbId),
        statusHistory: z.array(statusHistorySchema),
        createdAt: z.date(),
        updatedAt: z.date(),
        deletedAt: z.date().nullable(),
    }) satisfies z.ZodType<ProjectInfer>;

    public static validatorCreation = z.object({
        ...Project.validator.shape,
        id: Project.validator.shape.id.or(z.instanceof(Literal)).nullish(),
        statusHistory: Project.validator.shape.statusHistory.nullish(),
        lastApprovedById: Project.validator.shape.lastApprovedById.nullish(),
        deletedAt: Project.validator.shape.deletedAt.nullish(),
    });

    public static async validateExtended(obj: Project | ProjectInfer): Promise<boolean> {
        if (!obj) {
            return false;
        }

        let authorCount = await User.count({
            where: {
                id: obj.authorIds,
            },
        });

        if (authorCount != obj.authorIds.length) {
            Logger.warn(`Not all authors found for project validation.`);
            return false;
        }

        let game = await Game.findByPk(obj.gameName);
        if (!game) {
            Logger.warn(`Game not found for project validation.`);
            return false;
        }

        if (z.enum(game.categories).safeParse(obj.category).success === false) {
            Logger.warn(`Project category '${obj.category}' is not valid for game '${game.name}'.`);
            return false;
        }

        return true;
    }

    @AfterValidate
    private static async runValidators(project: Project) {
        if (project.isNewRecord) {
            Project.validatorCreation.parse(project);
        } else {
            Project.validator.parse(project);
        }
        let isValid = await Project.validateExtended(project);
        if (!isValid) {
            throw new Error(`Project validation failed in extended validation.`);
        }
    }
    // #endregion
    public static async checkIfExists(id: number): Promise<boolean> {
        return (await Project.findByPk(id, { attributes: ['id'] })) ? true : false;
    }
    // #region Permissions 
    public canView(user: User | null | undefined): Promise<boolean> {
        if (this.status === Status.Verified) {
            return Promise.resolve(true);
        }

        if (!user) {
            return Promise.resolve(false);
        }

        if (this.authorIds.includes(user.id)) {
            return Promise.resolve(true);
        }

        return Promise.resolve(user.checkRoles([UserPermissions.Mods_ViewAll], this.gameName));
    }

    public canEdit(user: User | null | undefined): Promise<boolean> {
        if (!user) {
            return Promise.resolve(false);
        }

        if (this.authorIds.includes(user.id)) {
            return Promise.resolve(true);
        }

        return Promise.resolve(user.checkRoles([UserPermissions.Mods_EditAll], this.gameName));
    }

    public canUploadVersion(user: User | null | undefined): Promise<boolean> {
        if (!user) {
            return Promise.resolve(false);
        }

        if (this.authorIds.includes(user.id)) {
            return Promise.resolve(true);
        }

        if (this.collaboratorIds.includes(user.id)) {
            return Promise.resolve(true);
        }

        return Promise.resolve(user.checkRoles([UserPermissions.Mods_UploadAll], this.gameName));
    }
    // #endregion
    // #region Version Lookups
    public async getLatestVersion(supportedGameVersionIds?: number, semverRange?: string, statuses: Status[] = [Status.Verified]): Promise<Version | null> {
        let whereOptions: WhereOptions<Version> = {
            projectId: this.id,
        }
        if (supportedGameVersionIds) {
            whereOptions.supportedGameVersionIds = {
                [Op.contains]: [supportedGameVersionIds],
            };
        }
        if (statuses && statuses.length > 0) {
            whereOptions.status = {
                [Op.in]: statuses,
            };
        }
        let sermverOnly = await Version.findAll({
            where: whereOptions,
            attributes: [`id`, `semver`]
        }).then(versions => versions.sort((a, b) => {
            if (a.semver && b.semver) {
                return b.semver.compare(a.semver);
            } else {
                return 0;
            }
        }));

        if (semverRange) {
            sermverOnly = sermverOnly.filter(v => {
                if (v.semver) {
                    return satisfies(v.semver, semverRange);
                } else {
                    return false;
                }
            });
        }

        if (sermverOnly.length > 0) {
            return Version.findByPk(sermverOnly[0].id, {
                include: { all: true },
            });
        } else {
            return null;
        }
    }
    // #endregion
    // #region Translation Lookup
    public async getTranslation(language: string): Promise<{ name: string | null, summary: string | null, description: string | null } | null> {
        let translations = await Translation.findAll({
            where: {
                parentId: this.id,
                contentType: { [Op.or]: [`name`, `summary`, `description`] },
                language: language,
            },
        });

        if (translations.length === 0) {
            return null;
        }

        let translationMap: { [key: string]: string | null } = {};
        for (let translation of translations) {
            translationMap[translation.contentType] = translation.translatedString;
            // check if translation is still accurate by comparing original string to current project values - if not, return null to indicate translation needs review
            if (translation.originalString) {
                let currentValue = (this as any)[translation.contentType];
                if (currentValue !== translation.originalString) {
                    Logger.warn(`Translation for project ID ${this.id} content type ${translation.contentType} may be outdated and in need of review.`);
                    translation.outOfDate = true;
                    await translation.save();
                    translationMap[translation.contentType] = null;
                }
            }
        }

        return {
            name: translationMap[`name`] || null,
            summary: translationMap[`summary`] || null,
            description: translationMap[`description`] || null,
        };
    }
    // #endregion
    // #region Edit
    public async updateProject(data: ProjectAllowedEdit, user: User): Promise<Project> {
        if (data.authorIds) {
            if (!data.authorIds.includes(user.id) && data.authorIds.length > 0) {
                throw new Error(`You must be an author to set authorship, and you cannot remove yourself as an author if there are no other authors.`);
            }
        }

        Object.assign(this, {
            summary: data.summary ?? this.summary,
            description: data.description ?? this.description,
            category: data.category ?? this.category,
            gitUrl: data.gitUrl ?? this.gitUrl,
            authorIds: data.authorIds ?? this.authorIds,
            collaboratorIds: data.collaboratorIds ?? this.collaboratorIds,
        });
        this.lastUpdatedById = user.id;
        return await this.save();
    }

    public async setStatus(newStatus: Status, user: User, reason: string, shouldSendWebhook = true): Promise<this> {
        let previousStatus = this.status;
        this.status = newStatus;
        // this.lastUpdatedById = user.id; // commented out to preserve last updater as the last person to edit mod details, not status
        if (newStatus === Status.Verified) {
            this.lastApprovedById = user.id;
        }
        this.statusHistory = [...this.statusHistory, {
            status: newStatus,
            reason: reason,
            userId: user.id,
            timestamp: new Date().toISOString(),
        }];
        try {
            await this.save();
        } catch (error) {
            Logger.error(`Failed to save project status change: ${error}`);
            throw error;
        }
        Logger.log(`Project ID ${this.id} status changed from ${previousStatus} to ${newStatus} by user ID ${user.id} for reason: ${reason}`);
        return this;
    }
    // #endregion
    // #region Report
    public async report(reportedBy: User, reason: string): Promise<ThingRequest> {
        let existingRequests = await ThingRequest.findAll({
            where: {
                requestResponseBy: this.lastUpdatedById,
                refrencedId: this.id,
                requestType: RequestType.Project_Report
            }
        });

        if (existingRequests.length > 0) {
            Logger.log(`User ${reportedBy.id} attempted to report project ${this.id} but a report already exists.`);
            return existingRequests[0];
        }

        Logger.log(`Creating report request for project ${this.id} by user ${reportedBy.id} for reason: ${reason}`);
        return await ThingRequest.create({
            refrencedId: this.id,
            requesterId: reportedBy.id,
            requestType: RequestType.Project_Report,
            requestResponseBy: null,
            messages: [{
                userId: reportedBy.id,
                message: reason,
                timestamp: new Date().toISOString(),
            }],
        });
    }
    // #region ToAPI
    public async toApiV3(language?: string): Promise<ProjectApiV3> {
        let authors = await User.findAll({
            where: {
                id: this.authorIds,
            },
        }).then((users) => users.map((user) => user.toApiV3()));

        let translation = null;
        if (language && !language.startsWith(`en`)) {
            translation = await this.getTranslation(language);
        }

        return {
            id: this.id,
            name: this.name,
            summary: this.summary,
            description: this.description,
            gameName: this.gameName,
            category: this.category,
            authors: authors,
            status: this.status,
            iconFileName: this.iconFileName,
            gitUrl: this.gitUrl,
            lastApprovedById: this.lastApprovedById,
            lastUpdatedById: this.lastUpdatedById,
            statusHistory: this.statusHistory,
            createdAt: this.createdAt,
            updatedAt: this.updatedAt,
            translation: translation,
        };
    }

    public async toApiV2(): Promise<ModApiv2> {
        let authors = await User.findAll({
            where: {
                id: this.authorIds,
            },
        }).then((users) => users.map((user) => user.toApiV2()));

        return {
            id: this.id,
            name: this.name,
            summary: this.summary,
            description: this.description,
            gameName: this.gameName,
            category: this.category,
            authors: authors, // to be filled in later
            status: this.status,
            iconFileName: this.iconFileName,
            gitUrl: this.gitUrl,
            lastApprovedById: this.lastApprovedById,
            lastUpdatedById: this.lastUpdatedById,
            statusHistory: this.statusHistory.map((entry) => ({
                status: entry.status,
                reason: entry.reason,
                userId: entry.userId,
                setAt: entry.timestamp.toString(),
            })),
            createdAt: this.createdAt,
            updatedAt: this.updatedAt,
        };
    }
    // #endregion
}