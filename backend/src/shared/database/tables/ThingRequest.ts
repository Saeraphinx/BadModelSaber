import { AfterValidate, AllowNull, BelongsTo, Column, CreatedAt, DataType, Default, DeletedAt, ForeignKey, Model, Table, UpdatedAt } from "sequelize-typescript";
import { InferAttributes, InferCreationAttributes, CreationOptional, NonAttribute } from "sequelize";
import { z } from "zod/v4";
import { AlertType, ThingRequestApiV3, dbId, LinkedAsset, LinkedAssetLinkType, RequestMessage, RequestType, Status, UserPermissions, WebhookLogType } from "../DBExtras.ts";
import { User } from "./User.ts";
import { Asset } from "./Asset.ts";
import { Alert } from "./Alert.ts";
import { Logger } from "../../Logger.ts";
import { parseErrorMessage } from "../../Tools.ts";
import { Project } from "./Project.ts";
import { Version } from "./Version.ts";
import { Webhooks } from "../../Webhooks.ts";

export type ThingRequestInfer = InferAttributes<ThingRequest>;
@Table({
    tableName: `thing_requests`,
    modelName: `ThingRequest`,
    timestamps: true,
    paranoid: true,
})
export class ThingRequest extends Model<InferAttributes<ThingRequest>, InferCreationAttributes<ThingRequest>> {
    // #region Columns
    @Column({
        type: DataType.INTEGER,
        autoIncrement: true,
        primaryKey: true,
        allowNull: false,
    })
    declare id: CreationOptional<number>;

    @AllowNull(false)
    @Column(DataType.INTEGER)
    declare refrencedId: number; // ID that this request is for

    @AllowNull(true)
    @Column(DataType.STRING)
    declare refrencedGameName: string | null; // game name that this request is for, is null for user reports

    @AllowNull(false)
    @ForeignKey(() => User)
    @Column(DataType.INTEGER)
    declare requesterId: number; // User ID of the person who made the request
    @BelongsTo(() => User, {
        foreignKey: `requesterId`,
    })
    private declare _requester?: NonAttribute<Promise<User | null>>; // This should be replaced with a User object in the actual implementation
    @Column({
        type: DataType.INTEGER,
        allowNull: true,
        defaultValue: null,
    })
    declare requestResponseBy: number | null; // User ID of the person who has been asked to respond to the request. null if this isn't for a specific user
    @Column({
        type: DataType.JSONB,
        allowNull: true,
        defaultValue: null,
    })
    declare objectToAdd: number | LinkedAsset | null; // number if an id to add to the collaberators, LinkedAsset if linking, null if report

    @Column({
        type: DataType.STRING,
        allowNull: false,
    })
    declare requestType: RequestType;

    @Column({
        type: DataType.BOOLEAN,
        allowNull: true,
        defaultValue: null,
    })
    declare accepted: CreationOptional<boolean | null>; // Whether the request has been accepted or not
    @Column({
        type: DataType.INTEGER,
        allowNull: true,
        defaultValue: null,
    })
    declare resolvedBy: CreationOptional<number | null>; // User ID of the person who resolved the request, null if not resolved

    @AllowNull(false)
    @Default([])
    @Column(DataType.ARRAY(DataType.JSONB))
    declare messages: CreationOptional<RequestMessage[]>; // Array of messages related to the request

    @CreatedAt
    declare createdAt: CreationOptional<Date>; // Timestamp of when the request was created
    @UpdatedAt
    declare updatedAt: CreationOptional<Date>; // Timestamp of when the request was last updated
    @DeletedAt
    declare deletedAt: CreationOptional<Date | null>; // Timestamp of when the request was deleted, null if not deleted

    public get requester(): NonAttribute<Promise<User | null>> {
        if (this._requester) {
            return Promise.resolve(this._requester) || null;
        } else {
            Logger.debug(`User not loaded, fetching from DB for requesterId: ${this.requesterId}`);
            return User.findByPk(this.requesterId) || null;
        }
    }

    public async getRefrencedAsset(): Promise<Asset | User | Project | Version | null> {
        switch (this.requestType) {
            case RequestType.Asset_Credit:
            case RequestType.Asset_Link:
            case RequestType.Asset_Report:
                return await Asset.findByPk(this.refrencedId);
            case RequestType.User_Report:
                return await User.findByPk(this.refrencedId);
            case RequestType.Project_Report:
                return await Project.findByPk(this.refrencedId);
            case RequestType.Version_Report:
                return await Version.findByPk(this.refrencedId);
            default:
                return Promise.resolve(null);
        }
    }

    // #endregion

    // #region Validators
    public static validator = z.object({
        id: dbId,
        refrencedId: dbId,//.refine(async (id) => await Asset.checkIfExists(id)),
        requesterId: dbId.refine(async (id) => await User.checkIfExists(id)),
        refrencedGameName: z.string().nullable(),
        requestResponseBy: dbId.nullable(),
        objectToAdd: z.union([dbId, z.object({
            id: dbId,
            linkType: z.enum(LinkedAssetLinkType),
        })]).nullable(),
        requestType: z.enum(RequestType),
        accepted: z.boolean().nullable(),
        resolvedBy: dbId.nullable().refine(async (id) => {
            if (id === null) return true; // If resolvedBy is null, no need
            return await User.checkIfExists(id);
        }),
        messages: z.array(z.object({
            userId: dbId.refine(async (id) => await User.checkIfExists(id)),
            message: z.string().max(1024),
            timestamp: z.iso.datetime(),
        })).default([]),
        createdAt: z.date(),
        updatedAt: z.date(),
        deletedAt: z.date().nullable(),
    }) satisfies z.ZodType<ThingRequestInfer>


    public static validatorCreation = z.object({
        ...ThingRequest.validator.shape,
        id: ThingRequest.validator.shape.id.nullish(), // id is optional when creating a new request
        accepted: ThingRequest.validator.shape.accepted.nullish(),
        resolvedBy: ThingRequest.validator.shape.resolvedBy.nullish(),
        messages: ThingRequest.validator.shape.messages.nullish(),
        createdAt: ThingRequest.validator.shape.createdAt.nullish(),
        updatedAt: ThingRequest.validator.shape.updatedAt.nullish(),
        deletedAt: ThingRequest.validator.shape.deletedAt.nullish(),
    })

    public static validateExtended(data: ThingRequest | ThingRequestInfer): string | null {
        if (data.requestType.includes("report") && data.objectToAdd !== null) {
            return "Reports cannot have objectToAdd set, it must be null."
        }

        if (data.requestType.includes("report") && data.requestType !== RequestType.User_Report && data.refrencedGameName == null) {
            return "Reports must have refrencedGameName set, it must not be null."
        }

        if (data.requestType === RequestType.Asset_Credit) {
            if (typeof data.objectToAdd === 'string') {
                return `Credit request must have an ID in objectToAdd`
            }
        } else if (data.requestType === RequestType.Asset_Link) {
            if (data.objectToAdd === null) return `If requestType is Link, objectToAdd must not be null`; // If requestType is Link, objectToAdd must not be null
            if (!(typeof data.objectToAdd === 'object' && 'id' in data.objectToAdd && 'linkType' in data.objectToAdd)) {
                return "If requestType is Link, objectToAdd must be a LinkedAsset"
            };
        }

        if (!data.requestType.includes("report") && data.requestResponseBy === null) {
            return "Requests must have a requestResponseBy ID set."
        }

        return null;
    }

    @AfterValidate
    private static async runValidators(instance: ThingRequest) {
        if (instance.isNewRecord) {
            await ThingRequest.validatorCreation.parseAsync(instance);
        } else {
            await ThingRequest.validator.parseAsync(instance);
        }
        let isNotValid = ThingRequest.validateExtended(instance);
        if (isNotValid) {
            throw new Error(isNotValid);
        }
    }

    // #endregion Validators
    public static async checkIfExists(id: number): Promise<boolean> {
        return (await ThingRequest.findByPk(id, { attributes: ['id'] })) ? true : false;
    }
    // #region Permission Checks
    public canView(user: User): boolean {
        if (user.id === this.requesterId) return true; // Requesters can always view their own requests
        if (this.requestResponseBy && user.id === this.requestResponseBy) return true; // The person who is asked to respond can view the request

        switch (this.requestType) {
            case RequestType.User_Report:
                return user.checkRoles([UserPermissions.Requests_ViewUsers, UserPermissions.Requests_ViewAll], this.refrencedGameName ?? undefined);
            case RequestType.Asset_Report:
            case RequestType.Asset_Credit:
            case RequestType.Asset_Link:
                return user.checkRoles([UserPermissions.Requests_ViewAssets, UserPermissions.Requests_ViewAll], this.refrencedGameName ?? undefined);
            case RequestType.Project_Report:
            case RequestType.Version_Report:
                return user.checkRoles([UserPermissions.Requests_ViewMods, UserPermissions.Requests_ViewAll], this.refrencedGameName ?? undefined);
            default:
                return false; // Only people with specific permissions or the requester/requestResponseBy can view reports, and only the requester/requestResponseBy can view non-report requests
        }
    }

    public canMessage(user: User): boolean {
        switch (this.requestType) {
            case RequestType.User_Report:
                return user.id === this.requesterId || user.checkRoles([UserPermissions.Requests_ManageUsers, UserPermissions.Requests_ManageAll], this.refrencedGameName ?? undefined);
            case RequestType.Asset_Report:
                return user.id === this.requesterId || user.checkRoles([UserPermissions.Requests_ManageAssets, UserPermissions.Requests_ManageAll], this.refrencedGameName ?? undefined);
            case RequestType.Project_Report:
            case RequestType.Version_Report:
                return user.id === this.requesterId || user.checkRoles([UserPermissions.Requests_ManageMods, UserPermissions.Requests_ManageAll], this.refrencedGameName ?? undefined);
            default:
                return false;
        }
    }

    public canAccept(user: User): boolean {
        switch (this.requestType) {
            case RequestType.User_Report:
                return user.checkRoles([UserPermissions.Requests_ManageUsers, UserPermissions.Requests_ManageAll], this.refrencedGameName ?? undefined);
            case RequestType.Asset_Report:
                return user.checkRoles([UserPermissions.Requests_ManageAssets, UserPermissions.Requests_ManageAll], this.refrencedGameName ?? undefined);
            case RequestType.Project_Report:
            case RequestType.Version_Report:
                return user.checkRoles([UserPermissions.Requests_ManageMods, UserPermissions.Requests_ManageAll], this.refrencedGameName ?? undefined);
            default:
                return user.id === this.requestResponseBy || user.checkRoles([UserPermissions.Requests_ManageAll], this.refrencedGameName ?? undefined);
        }
    }
    // #endregion Permission Checks

    public addMessage(user: User, message: string): Promise<this> {
        Logger.log(`Adding message to request ${this.id} from user ${user.id}`);
        this.messages = [
            ...this.messages,
            {
                userId: user.id,
                message: message,
                timestamp: new Date(Date.now()).toISOString(),
            }
        ]
        return this.save().then((tr) => {
            Webhooks.sendWebhookLog(this.refrencedGameName || `beatsaber`, WebhookLogType.Text_NewReportMessage, false, Promise.resolve(`New message on ${tr.requestType} request #${tr.id} from user ${user.username}: ${message}`));
            return tr;
        });
    }

    public alertReporter(data: {
        type: AlertType;
        header: string;
        message: string;
    }): Promise<Alert> {
        return User.createAlert(this.requesterId, {
            ...data,
            requestId: this.id,
        });
    }

    // #region handle reports
    public async accept(acceptedBy: User, shouldRemove = false, silent = false): Promise<this> {
        let refrencedThing = await this.getRefrencedAsset();
        if (!refrencedThing) {
            throw new Error(`Referenced asset not found.`);
        }
        switch (this.requestType) {
            case RequestType.Asset_Credit:
                let refrencedAsset = refrencedThing as Asset;
                refrencedAsset.collaboratorIds = [
                    ...refrencedAsset.collaboratorIds,
                    this.objectToAdd as number
                ];
                await refrencedAsset.save();
                break;
            case RequestType.Asset_Link:
                refrencedAsset = refrencedThing as Asset;
                let obj = this.objectToAdd as LinkedAsset;
                let otherAsset = await Asset.findByPk(obj.id);
                if (!otherAsset) {
                    throw new Error(`Linked asset not found.`);
                }
                await refrencedAsset.addLink(otherAsset, obj.linkType);
                break;
            case RequestType.Asset_Report:
            case RequestType.Version_Report:
            case RequestType.Project_Report:
                let refThing = refrencedThing as Asset | Version | Project;
                shouldRemove ? await refThing.setStatus(Status.Removed, acceptedBy, `Report ID ${this.id}`, false) : null;
                let thingType = this.requestType === RequestType.Asset_Report ? `asset` : this.requestType === RequestType.Version_Report ? `version` : `project`;
                if (!silent && shouldRemove) {
                    let thingAlert = refThing instanceof Asset ? refThing.alertUploader : refThing instanceof Version ? refThing.createAlert : refThing.createAlertForAuthors;
                    let thingName = refThing instanceof Version ? `${(await refThing.project)?.name} v${refThing.semver.raw}` : refThing.name;
                    thingAlert({
                        type: AlertType.ThingBad,
                        header: `Your ${thingType} ${thingName} has been removed.`,
                        message: `Your ${thingType} has been removed. Please do not re-upload the ${thingType}. If you have any question, please contact the approval team.`,
                    })
                }
                break;
            case RequestType.User_Report:
                break; // No automatic action for user reports, maybe in the future we could add automatic banning or something like that, but for now just leave it as is and let the moderators handle it manually
            default:
                throw new Error(`Invalid request type.`);
        }

        if (this.requestType.endsWith("report")) {
            this.alertReporter({
                type: AlertType.RequestAccepted,
                header: `Your report has been accepted`,
                message: `Your report has been accepted & closed. If you have any question, please contact the approval team.`
            }).catch((e) => {
                Logger.warn(`Unable to alert requester: ${parseErrorMessage(e)}`)
            });
        }

        this.accepted = true;
        this.resolvedBy = acceptedBy.id;
        this.messages = [
            ...this.messages,
            { 
                userId: 5, 
                message: `Request accepted by ${acceptedBy.username}`, 
                timestamp: new Date(Date.now()).toISOString() 
            }
        ]
        Logger.log(`Request ${this.id} accepted by user ${acceptedBy.id}`);
        return await this.save();
    }

    public async decline(declinedBy: User, silent = false): Promise<this> {
        this.accepted = false;
        this.resolvedBy = declinedBy.id;
        if (!silent) {
            this.alertReporter({
                type: AlertType.RequestDeclined,
                header: `Your request has been declined`,
                message: `Your request has been closed. If you have any questions, please contact the approval team.`
            }).catch((e) => {
                Logger.warn(`Unable to alert requester: ${parseErrorMessage(e)}`)
            });
        }
        this.messages = [
            ...this.messages,
            { 
                userId: 5, 
                message: `Request declined by ${declinedBy.username}`, 
                timestamp: new Date(Date.now()).toISOString() 
            }
        ]
        Logger.log(`Request ${this.id} declined by user ${declinedBy.id}`);
        return await this.save();
    }
    // #endregion handle reports

    public async toApiV3(): Promise<ThingRequestApiV3> {
        let refrencedThing = await this.getRefrencedAsset();
        let requester = await this.requester;

        let refThingApi = null;
        let requesterApi = null;

        if (refrencedThing && requester) {
            refThingApi = await refrencedThing.toApiV3();
            requesterApi = await requester.toApiV3();
        }

        let thingName = `???`;
        if (refrencedThing == null) {
            thingName = `???`;
        } else if (`name` in refrencedThing) {
            thingName = refrencedThing.name;
        } else if (`username` in refrencedThing) {
            thingName = refrencedThing.username;
        } else {
            thingName = `${(await refrencedThing.project)?.name} v${refrencedThing.semver.raw}`;
        }

        return {
            id: this.id,
            refrencedThingId: this.refrencedId,
            refrencedThing: refThingApi,
            refrencedThingName: thingName,
            refrencedGameName: this.refrencedGameName,
            requesterId: this.requesterId,
            requester: requesterApi,
            requestResponseBy: this.requestResponseBy,
            requestType: this.requestType,
            messages: this.messages,
            accepted: this.accepted,
            resolvedBy: this.resolvedBy,
            createdAt: this.createdAt,
            updatedAt: this.updatedAt
        };
    }
}