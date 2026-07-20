import { AfterCreate, AfterValidate, AllowNull, BelongsTo, BelongsToMany, Column, CreatedAt, DataType, Default, DeletedAt, ForeignKey, Model, Table, UpdatedAt } from "sequelize-typescript";
import { col, CreationOptional, InferAttributes, InferCreationAttributes, NonAttribute, Op, Sequelize, WhereOptions } from "sequelize";
import { AlertType, dbId, ModApiv2, ProjectApiV3, RequestType, Status, StatusHistory, statusHistorySchema, UserApiV3, UserPermissions, WebhookLogType } from "../DBExtras.ts";
import z from "zod/v4";
import { Game } from "./Game.ts";
import { Logger } from "../../Logger.ts";
import { User } from "./User.ts";
import { ProjectAuthor } from "./Junctions.ts";
import { Version } from "./Version.ts";
import { satisfies } from "semver";
import { Translation } from "./Translation.ts";
import { IReportable, IPermissionsChecks } from "./common.ts";
import { ThingRequest } from "./ThingRequest.ts";
import { Literal } from "sequelize/lib/utils";
import { EnvConfig } from "../../EnvConfig.ts";
import path from "path";
import { Webhook } from "discord.js";
import { WebhookPayloadGenerator, Webhooks } from "../../Webhooks.ts";
import { Alert } from "./Alert.ts";
import { GameVersion } from "./GameVersion.ts";


export type ProjectInfer = InferAttributes<Project>;
export type ProjectAllowedEdit = Partial<Pick<Project, `summary` | `description` | `category` | `gitUrl` | `collaboratorIds`> & { authorIds: number[] }>;
export type ProjectWhereOptions = WhereOptions<Project>;
export type ProjectValidStatuses = Status.Verified | Status.Private | Status.Removed;
export const ProjectValidStatusesArray = [Status.Verified, Status.Private, Status.Removed] as const;

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
    declare nameId: string; // the name of the project - but the ID version that is used for dependency resolution within BSIPA

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

    @BelongsToMany(() => User, () => ProjectAuthor)
    declare authors: NonAttribute<User[] | undefined>;

    @AllowNull(false)
    @Default([])
    @Column(DataType.ARRAY(DataType.INTEGER))
    declare collaboratorIds: CreationOptional<number[]>; // the ids of the users who are collaborators on this project

    @AllowNull(false)
    @Default(Status.Private)
    @Column(DataType.STRING)
    declare status: CreationOptional<ProjectValidStatuses>; // the current status of the project

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
            this._game = Game.findByPk(this.gameName) || null;
            return this._game;
        }
    }

    private get authorIds(): NonAttribute<Promise<number[]>> {
        if (this.authors && this.authors.length > 0) {
            return Promise.resolve(this.authors.map(a => a.id));
        } else {
            Logger.debug(`Authors not loaded, fetching from DB for project ID: ${this.id}`);
            return this.$get(`authors`, { attributes: ['id'] }).then(authors => authors?.map(a => a.id) as number[]) || Promise.resolve([]);
        }
    }

    get folderPath(): NonAttribute<string> {
        return path.join(EnvConfig.uploadsPath, this.id.toString());
    }

    get iconUrl(): NonAttribute<string> {
        return this.iconFileName.includes(`default`) ? `${EnvConfig.server.backendUrl}${EnvConfig.server.fileRoute}/default-${this.gameName}.png` : `${EnvConfig.server.backendUrl}/${EnvConfig.server.fileRoute}/${this.id}/${this.iconFileName}`;
    }
    // #endregion
    // #region Validatiors
    /*
    private static validatorTypeTest1: z.infer<typeof Project.validator> = ({} as Project); // validator has property asset doesn't
    private static validatorTypeTest2: ProjectInfer = ({} as z.infer<typeof Project.validator>); // asset has property validator doesn't
    */

    public static validator = z.object({
        id: dbId,
        nameId: z.string().regex(new RegExp("^(.*)$")).describe("project name for dependency resolution"),
        name: z.string().max(128),
        summary: z.string().max(256),
        description: z.string().max(8192),
        gameName: z.string(),
        category: z.string(),
        status: z.enum(ProjectValidStatusesArray),
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
        collaboratorIds: Project.validator.shape.collaboratorIds.nullish(),
        status: Project.validator.shape.status.nullish(),
        statusHistory: Project.validator.shape.statusHistory.nullish(),
        lastApprovedById: Project.validator.shape.lastApprovedById.nullish(),
        deletedAt: Project.validator.shape.deletedAt.nullish(),
    });

    public static async validateExtended(obj: Project | ProjectInfer): Promise<boolean> {
        if (!obj) {
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
        return (await Project.unscoped().findByPk(id, { attributes: ['id'] })) ? true : false;
    }
    // #region Permissions 
    public async canView(user: User | null | undefined): Promise<boolean> {
        if (User.getAllowedStatuses(user, `mod`, this.gameName).includes(this.status)) {
            return true;
        }

        if (!user) {
            return false;
        }

        if ((await this.authorIds).includes(user.id)) {
            return true;
        }

        return false;
    }

    public async canEdit(user: User | null | undefined): Promise<boolean> {
        if (!user) {
            return false;
        }

        if ((await this.authorIds).includes(user.id)) {
            return true;
        }

        return user.checkRoles([UserPermissions.Mods_EditAll], this.gameName);
    }

    public async canUploadVersion(user: User | null | undefined): Promise<boolean> {
        if (!user) {
            return false;
        }

        if ((await this.authorIds).includes(user.id)) {
            return true;
        }

        if (this.collaboratorIds.includes(user.id)) {
            return true;
        }

        return user.checkRoles([UserPermissions.Mods_UploadAll], this.gameName);
    }

    public async canTranslate(user: User | null | undefined): Promise<boolean> {
        if (!user) {
            return false;
        }

        if ((await this.authorIds).includes(user.id)) {
            return true;
        }

        if (this.collaboratorIds.includes(user.id)) {
            return true;
        }

        return user.checkRoles([UserPermissions.Mods_EditAll, UserPermissions.Mods_TranslateAll], this.gameName);
    }
    // #endregion
    // #region Version Lookups
    public async getLatestVersion(supportedGameVersionIds?: number, semverRange?: string, statuses: Status[] = [Status.Verified]): Promise<Version | null> {
        let whereOptions: WhereOptions<Version> = {
            projectId: this.id,
        }

        if (statuses && statuses.length > 0) {
            whereOptions.status = {
                [Op.in]: statuses,
            };
        }
        let sermverOnly = await Version.findAll({
            where: whereOptions,
            attributes: [`id`, `semver`],
            include: supportedGameVersionIds ? [{
                model: GameVersion,
                where: {
                    id: supportedGameVersionIds,
                },
                through: { attributes: [] },
                required: true,
            }] : [],
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
                    translation.markOutOfDate(this).catch(err => {
                        Logger.error(`Failed to mark translation as out of date for project ID ${this.id}: ${err}`);
                    });
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
    // #region Alerts
    public async createAlertForAuthors(data: {
        type: AlertType;
        header: string;
        message: string;
        versionId?: number | null;
    }, includeCollaborators = true, additionalIds?: number[]): Promise<void | Promise<Alert>[]> {
        let userIds = Array.from(includeCollaborators ? new Set([...(await this.authorIds), ...(this.collaboratorIds || []), ...additionalIds || []]) : new Set([...(await this.authorIds), ...additionalIds || []]));
        let users = User.findAll({
            where: {
                id: userIds,
            },
        }).then(users => {
            let promises: Promise<Alert>[] = [];
            for (let user of users) {
                promises.push(user.createAlert({
                    type: data.type,
                    projectId: this.id,
                    versionId: data.versionId || null,
                    header: data.header,
                    message: data.message,
                }));
            };
            return promises;
        }).catch(err => {
            Logger.error(`Failed to find users for creating alerts for project ID ${this.id}: ${err}`);
        });
        return await users;
    }
    // #endregion
    // #region Edit
    public async updateProject(data: ProjectAllowedEdit, user: User): Promise<Project> {
        if (data.description && data.description !== this.description) {
            Translation.findAll({
                where: {
                    parentId: this.id,
                    contentType: `description`,
                }
            }).then(t => t.forEach(ti => ti.markOutOfDate(this))).catch(err => {
                Logger.error(`Failed to mark description translations as out of date for project ID ${this.id}: ${err}`);
            });
        }

        if (data.summary && data.summary !== this.summary) {
            Translation.findAll({
                where: {
                    parentId: this.id,
                    contentType: `summary`,
                }
            }).then(t => t.forEach(ti => ti.markOutOfDate(this))).catch(err => {
                Logger.error(`Failed to mark description translations as out of date for project ID ${this.id}: ${err}`);
            });
        }

        Object.assign(this, {
            summary: data.summary ?? this.summary,
            description: data.description ?? this.description,
            category: data.category ?? this.category,
            gitUrl: data.gitUrl ?? this.gitUrl,
            collaboratorIds: data.collaboratorIds ?? this.collaboratorIds,
        });
        if (data.authorIds) {
            await this.$set(`authors`, data.authorIds);
        }
        this.lastUpdatedById = user.id;
        Webhooks.sendWebhookLog(this.gameName, WebhookLogType.Text_Edited, false, WebhookPayloadGenerator.generateEditedThingPayload(this, user));
        return await this.save();
    }

    public async setStatus(newStatus: ProjectValidStatuses, user: User, reason: string, shouldAlert = true, shouldSendWebhook = true): Promise<this> {
        let previousStatus = this.status;
        this.status = newStatus;
        this.statusHistory = [...this.statusHistory, {
            status: newStatus,
            reason: reason,
            userId: user.id,
            timestamp: new Date().toISOString(),
        }];

        if (newStatus === Status.Verified) {
            this.lastApprovedById = user.id;
        }

        await this.save().then(() => {
            Logger.info(`Project ID ${this.id} status changed from ${previousStatus} to ${newStatus} by user id ${user.id} for reason: ${reason}`);
        }).catch((err) => {
            Logger.error(`Error updating Project status for Project id ${this.id} from ${previousStatus} to ${newStatus} by user id ${user.id} for reason: ${reason}: ${err}`);
            throw err;
        });

        let isFirstVerification = newStatus === Status.Verified && this.statusHistory.some(entry => entry.status === Status.Verified) === false;
        let wasPrivated = previousStatus !== Status.Private && newStatus === Status.Private;
        let wasRemoved = previousStatus !== Status.Removed && newStatus === Status.Removed;

        if (shouldSendWebhook) {
            let internalEmbedPayload = WebhookPayloadGenerator.generateInternalStatusUpdateEmbedPayload(this, user, previousStatus, newStatus, reason);
            let externalEmbedPayload = WebhookPayloadGenerator.generateNewlyVerifiedThingEmbedPayload(this, user);

            Webhooks.sendWebhookLog(this.gameName, WebhookLogType.Text_StatusUpdate, false, WebhookPayloadGenerator.generateStatusPayload(this, user, previousStatus, newStatus, reason));
            Webhooks.sendWebhookLog(this.gameName, WebhookLogType.StatusUpdate, false, internalEmbedPayload);

            if (isFirstVerification) {
                Webhooks.sendWebhookLog(this.gameName, WebhookLogType.FirstVerificationProject, false, externalEmbedPayload);
            }
        }

        if (shouldAlert) {
            let authorsAndCollaborators = Array.from(new Set([...(await this.authorIds || []), ...(this.collaboratorIds || [])]));
            User.findAll({
                where: {
                    id: authorsAndCollaborators,
                },
            }).then(users => {
                for (let u of users) {
                    if (wasPrivated) {
                        u.createAlert({
                            type: AlertType.ThingWarn,
                            projectId: this.id,
                            header: `Your project "${this.name}" has been privated.`,
                            message: `Your project "${this.name}" has been privated by ${user.username}. It is no longer publicly visible.`,
                        }).catch(err => {
                            Logger.error(`Failed to create privated alert for user ID ${u.id} on project ID ${this.id}: ${err}`);
                        });
                    } else if (wasRemoved) {
                        u.createAlert({
                            type: AlertType.ThingWarn,
                            projectId: this.id,
                            header: `Your project "${this.name}" has been removed.`,
                            message: `Your project "${this.name}" has been removed. It is no longer publicly visible.`,
                        }).catch(err => {
                            Logger.error(`Failed to create removed alert for user ID ${u.id} on project ID ${this.id}: ${err}`);
                        });
                    }
                }
            }).catch(err => {
                Logger.error(`Failed to find users for project ID ${this.id} when creating status change alerts: ${err}`);
            });
        }

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
        }).then(async (request) => {
            Webhooks.sendWebhookLog(this.gameName, WebhookLogType.NewReport, false, WebhookPayloadGenerator.generateNewReportEmbedPayload(request, this, reportedBy, reason));
            return request;
        }).catch(err => {
            Logger.error(`Failed to create report request for project ${this.id} by user ${reportedBy.id}: ${err}`);
            throw err;
        });
    }
    // #endregion
    // #region ToAPI
    public async toApiV3(language?: string): Promise<ProjectApiV3> {
        let authors: UserApiV3[] = this.authors ? await Promise.all(this.authors.map(a => a.toApiV3())) : [];
        let translation = null;
        if (language && !language.startsWith(`en`)) {
            translation = await this.getTranslation(language);
        }

        if (authors.length === 0) {
            Logger.warn(`Project ID ${this.id} has no authors loaded when running toApiV3.`);
        }

        return {
            id: this.id,
            name: this.name,
            nameId: this.nameId,
            summary: this.summary,
            description: this.description,
            gameName: this.gameName,
            category: this.category,
            authors: authors,
            status: this.status,
            iconFileUrl: this.iconUrl,
            gitUrl: this.gitUrl,
            lastApprovedById: this.lastApprovedById,
            lastUpdatedById: this.lastUpdatedById,
            statusHistory: this.statusHistory,
            createdAt: this.createdAt,
            updatedAt: this.updatedAt,
            translation: translation,
        };
    }

    public async toApiV2(gameVersionId?: number): Promise<ModApiv2> {
        let authors = this.authors ? await Promise.all(this.authors.map(a => a.toApiV2())) : [];

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