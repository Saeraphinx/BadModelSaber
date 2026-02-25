import { AllowNull, BelongsTo, Column, CreatedAt, DataType, Default, DeletedAt, ForeignKey, Model, Table, UpdatedAt } from "sequelize-typescript";
import { col, CreationOptional, InferAttributes, InferCreationAttributes, NonAttribute, Op, Sequelize, WhereOptions } from "sequelize";
import { ModApiv2, ProjectApiV3, Status, StatusHistory, StatusHistorySchema, UserPermissions } from "../DBExtras.ts";
import z from "zod/v4";
import { Game } from "./Game.ts";
import { Logger } from "../../Logger.ts";
import { User } from "./User.ts";
import { Version } from "./Version.ts";
import { Range, satisfies, SemVer } from "semver";


export type ProjectInfer = InferAttributes<Project>;
export type ProjectAllowedEdit = Partial<Pick<Project, `summary` | `description` | `category` | `gitUrl` | `authorIds`>>;
export type ProjectWhereOptions = WhereOptions<Project>;

@Table({
    tableName: `projects`,
    modelName: `Project`,
    timestamps: true,
    paranoid: true,
    hooks: {
        afterValidate: async (project: Project) => {
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
    }
})
export class Project extends Model<InferAttributes<Project>, InferCreationAttributes<Project>> {
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

    @Column(DataType.TEXT)
    @AllowNull(false)
    declare name: string; // the name of the project

    @Column(DataType.TEXT)
    @AllowNull(false)
    declare summary: string; // a short summary of the project - for display in lists

    @Column(DataType.TEXT)
    @AllowNull(false)
    declare description: string; // a longer description of the project - for the project details page - think a readme

    @Column(DataType.TEXT)
    @AllowNull(false)
    @ForeignKey(() => Game)
    declare gameName: string; // the id of the game that this project is for
    @BelongsTo(() => Game, `gameName`)
    declare _game: NonAttribute<Promise<Game | null>>;

    @Column(DataType.TEXT)
    @AllowNull(false)
    declare category: string; // what to categorize this project as

    @Column(DataType.ARRAY(DataType.INTEGER))
    @AllowNull(false)
    declare authorIds: number[]; // the ids of the users who are authors of this project

    @Column(DataType.TEXT)
    @AllowNull(false)
    declare status: Status; // the current status of the project

    @Column(DataType.TEXT)
    @AllowNull(false)
    declare iconFileName: string; // the filename of the project's icon image

    @Column(DataType.TEXT)
    @AllowNull(false)
    declare gitUrl: string; // the URL of the project's git repository

    @Column(DataType.TEXT)
    @AllowNull(true)
    declare lastApprovedById: CreationOptional<number> | null;

    @Column(DataType.INTEGER)
    @AllowNull(false)
    declare lastUpdatedById: number;

    @Column(DataType.ARRAY(DataType.JSONB))
    @AllowNull(false)
    @Default([])
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
    // #endregion
    // #region Validatiors
    /*
    private static validatorTypeTest1: z.infer<typeof Project.validator> = ({} as Project); // validator has property asset doesn't
    private static validatorTypeTest2: ProjectInfer = ({} as z.infer<typeof Project.validator>); // asset has property validator doesn't
    */

    public static validator = z.object({
        id: z.number().int().positive(),
        name: z.string().max(128),
        summary: z.string().max(256),
        description: z.string().max(4096),
        gameName: z.string(),
        category: z.string(),
        authorIds: z.array(z.number().int().positive()),
        status: z.enum(Status),
        iconFileName: z.string(),
        gitUrl: z.url(),
        lastApprovedById: z.number().int().positive().nullable(),
        lastUpdatedById: z.number().int().positive(),
        statusHistory: z.array(StatusHistorySchema),
        createdAt: z.date(),
        updatedAt: z.date(),
        deletedAt: z.date().nullable(),
    }) satisfies z.ZodType<ProjectInfer>;

    public static validatorCreation = z.object({
        ...Project.validator.shape,
        id: Project.validator.shape.id.nullish(),
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
    // #endregion
    // #region Permissions 
    public canView(user: User | null | undefined): Promise<boolean> {
        if (this.status === Status.Verified) {
            return Promise.resolve(true);
        }

        if (!user) {
            return Promise.resolve(false);
        }

        if (this.status === Status.Unverified) {
            return Promise.resolve(user.checkRoles({ 
                gameName: this.gameName,
                perGamePermissions: [UserPermissions.View_Unverified_Mods, UserPermissions.View_All_Mods]
            }));
        } else if (this.status === Status.Pending) {
            return Promise.resolve(user.checkRoles({ 
                gameName: this.gameName,
                perGamePermissions: [UserPermissions.View_Pending_Mods, UserPermissions.View_All_Mods]
            }));
        } else {
            return Promise.resolve(user.checkRoles({ 
                gameName: this.gameName,
                perGamePermissions: [UserPermissions.View_All_Mods]
            }));
        }
    }

    public canEdit(user: User | null | undefined): Promise<boolean> {
        if (!user) {
            return Promise.resolve(false);
        }

        if (this.authorIds.includes(user.id)) {
            return Promise.resolve(true);
        }

        return Promise.resolve(user.checkRoles({
            gameName: this.gameName,
            perGamePermissions: [UserPermissions.Edit_Mods]
        }));
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
    // #region Edit
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
            changedById: user.id,
            changedAt: new Date().toISOString(),
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
    // #region ToAPI
    public async toPublicApiV3(): Promise<ProjectApiV3> {
        let authors = await User.findAll({
            where: {
                id: this.authorIds,
            },
        }).then((users) => users.map((user) => user.toApiV3()));

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
        };
    }

    public async toPublicApiV2(): Promise<ModApiv2> {
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
                userId: entry.changedById,
                setAt: entry.changedAt,
            })),
            createdAt: this.createdAt,
            updatedAt: this.updatedAt,
        };
    }
    // #endregion
}