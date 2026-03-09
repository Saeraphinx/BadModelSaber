import { AfterValidate, AllowNull, BelongsTo, Column, CreatedAt, DataType, Default, DeletedAt, ForeignKey, Model, Table, Unique, UpdatedAt } from "sequelize-typescript";
import { InferAttributes, InferCreationAttributes, NonAttribute, CreationOptional } from "sequelize";
import { Alert, ThingRequest, User, UserPermissions } from "../../Database.ts";
import { AlertType, AssetApiV3, AssetFileFormat, AssetPublicAPIv1, AssetPublicAPIv2, dbId, License, LinkedAsset, LinkedAssetLinkType, RequestType, Status, StatusHistory, Tags, UserApiV3, WebhookLogType } from "../DBExtras.ts";
import { z } from "zod/v4";
import { EnvConfig } from "../../EnvConfig.ts";
import { Logger } from "../../Logger.ts";
import { WebhookPayloadGenerator, Webhooks } from "../../Webhooks.ts";
import path from "node:path";
import { IEditable, IReportable, IViewable } from "./common.ts";

export type AssetInfer = InferAttributes<Asset>;
export type AssetValidatorType = typeof Asset.validator; // for use in frontend
@Table({
    tableName: `assets`,
    modelName: `Asset`,
    timestamps: true,
    paranoid: true,
})
export class Asset extends Model<InferAttributes<Asset>, InferCreationAttributes<Asset>> implements IViewable, IReportable, IEditable {
    // #region Columns
    @Column({
        type: DataType.INTEGER,
        autoIncrement: true,
        primaryKey: true,
        allowNull: false,
        unique: true,
    })
    declare readonly id: CreationOptional<number>;
    @Column({
        type: DataType.INTEGER,
        allowNull: true,
        defaultValue: null,
        unique: true,
    })
    declare oldId: CreationOptional<number | null>; // id from modelsaber, if applicable
    @Column({
        type: DataType.JSON,
        allowNull: false,
        defaultValue: [],
    })
    declare linkedIds: CreationOptional<LinkedAsset[]>; // models that are linked to this asset, e.g. a pc .saber may have a linked .wacker, or a model may have a newer version that is linked to it

    @AllowNull(false)
    @Column(DataType.STRING)
    declare type: AssetFileFormat;

    @AllowNull(false)
    @ForeignKey(() => User)
    @Column(DataType.INTEGER)
    declare uploaderId: number; // User ID of the uploader, this is not the author, but the person who uploaded the asset to the platform
    @BelongsTo(() => User, {
        foreignKey: `uploaderId`,
    })
    private declare _uploader?: NonAttribute<Promise<User | null>>;
    
    @AllowNull(false)
    @Default([])
    @Column(DataType.ARRAY(DataType.INTEGER))
    declare collaborators: CreationOptional<number[]>; // credits for the asset, e.g. "Model by John Doe, Textures by Jane Smith"
    
    @AllowNull(false)
    @Column(DataType.TEXT)
    declare name: string;

    @AllowNull(false)
    @Column(DataType.TEXT)
    declare description: string;


    @AllowNull(false)
    @Column(DataType.STRING)
    declare license: License; // e.g. CC-BY, CC0, etc. or 'custom'
    
    @AllowNull(true)
    @Default(null)
    @Column(DataType.STRING)
    declare licenseUrl: CreationOptional<string | null>; // URL to the license, if applicable (e.g. custom is set for license)
    
    @AllowNull(true)
    @Default(null)
    @Column(DataType.STRING)
    declare sourceUrl: CreationOptional<string | null>; // URL to the source of the asset, if applicable;
    
    @AllowNull(false)
    @Column(DataType.STRING)
    declare fileSafeName: string; // file-safe version of the asset name
    
    @AllowNull(false)
    @Unique
    @Column(DataType.STRING)
    declare fileHash: string;

    @AllowNull(false)
    @Column(DataType.INTEGER)
    declare fileSize: number;
    
    @AllowNull(false)
    @Default([])
    @Column(DataType.ARRAY(DataType.STRING))
    declare iconNames: CreationOptional<string[]>; // names of the icons associated with the asset, e.g. ["icon1.png", "icon2.png"]
    
    @AllowNull(false)
    @Default(Status.Private)
    @Column(DataType.STRING)
    declare status: CreationOptional<Status>;

    @Column({
        type: DataType.JSONB,
        allowNull: false,
        defaultValue: [],
    })
    declare statusHistory: CreationOptional<StatusHistory[]>;

    @Column({
        type: DataType.ARRAY(DataType.STRING),
        allowNull: false,
        defaultValue: [],
    })
    declare tags: CreationOptional<Tags[]>; // system defined tags

    @AllowNull(false)
    @Column(DataType.STRING)
    declare gameName: string; // the game this asset is for, e.g. beatsaber, oculus, etc.
    // #endregion

    @CreatedAt
    declare readonly createdAt: CreationOptional<Date>;
    @UpdatedAt
    declare readonly updatedAt: CreationOptional<Date>;
    @DeletedAt
    declare readonly deletedAt: CreationOptional<Date | null>;

    get uploader(): NonAttribute<Promise<User | null>> {
        if (this._uploader) {
            return Promise.resolve(this._uploader) || null;
        } else {
            Logger.debug(`User not loaded, fetching from DB for uploaderId: ${this.uploaderId}`);
            return User.findByPk(this.uploaderId) || null;
        }
    }

    get folderPath(): NonAttribute<string> {
        return path.join(EnvConfig.storage.uploads, this.id.toString());
    }

    get assetFilePath(): NonAttribute<string> {
        return path.join(this.folderPath, this.assetFileName);
    }

    get assetFileName(): NonAttribute<string> {
        return `${this.fileSafeName}.${this.type.split('_')[1]}`; // e.g. ".saber"
    }
    // #endregion

    private static readonly invalidFileNameChars = /[<>:"/\\|?*\x00-\x1F]/gi;
    private static readonly invalidFileNameWin = /^(CON|PRN|AUX|NUL|COM[1-9]|LPT[1-9])(\..*)?$/gi;

    // #region Validators
    public static validator = z.object({
        // unique by db
        id: z.number().int().positive(),
        // unique by db
        oldId: z.number().int().nullable(),
        linkedIds: z.array(z.object({
            id: dbId.refine(async (id) => await Asset.checkIfExists(id)),
            linkType: z.enum(LinkedAssetLinkType),
        })),
        type: z.enum(AssetFileFormat),
        uploaderId: dbId.refine(async (id) => await User.checkIfExists(id)),
        collaborators: z.array(dbId),
        name: z.string().min(1).max(64),
        description: z.string().max(4096),
        license: z.enum(Object.values(License)),
        licenseUrl: z.url().nullable(),
        sourceUrl: z.url().nullable(),
        fileSafeName: z.string().min(1).max(128).refine(str => !Asset.invalidFileNameChars.test(str), `Invalid charecters`).refine(str => !Asset.invalidFileNameWin.test(str), "File name is a reserved Windows name"),
        // unique by db
        fileHash: z.string().min(1).max(64),
        fileSize: z.number().int().positive(),
        iconNames: z.array(z.string()).max(5),
        status: z.enum(Status),
        statusHistory: z.array(z.object({
            status: z.enum(Status),
            reason: z.string().max(512),
            timestamp: z.iso.datetime(),
            userId: dbId.refine(async (id) => await User.checkIfExists(id)), // User ID of the person who changed the status
        })),
        tags: z.array(z.enum(Tags)).default([]),
        gameName: z.string().min(1).max(64),
        createdAt: z.date(),
        updatedAt: z.date(),
        deletedAt: z.date().nullable(),
    }) satisfies z.ZodType<AssetInfer>;


    // This validator is used for creating new assets, it omits the id and timestamps and other fields that are marked as CreationOptional
    public static validatorCreation = z.object({
        ...Asset.validator.shape,
        id: Asset.validator.shape.id.nullish(),
        oldId: Asset.validator.shape.oldId.nullish(),
        linkedIds: Asset.validator.shape.linkedIds.nullish(),
        collaborators: Asset.validator.shape.collaborators.nullish(),
        licenseUrl: Asset.validator.shape.licenseUrl.nullish(),
        sourceUrl: Asset.validator.shape.sourceUrl.nullish(),
        createdAt: Asset.validator.shape.createdAt.nullish(),
        updatedAt: Asset.validator.shape.updatedAt.nullish(),
        deletedAt: Asset.validator.shape.deletedAt.nullish(),
    })

    // if string is return, its an error. if its a null, its oki
    public static validateExtended(data: Asset | AssetInfer): string | null {
        if (data.license === 'custom' && !data.licenseUrl) {
            return `If license is custom, licenseUrl must be provided`;
        } else if (data.license !== 'custom' && data.licenseUrl) {
            return `If license is not custom, licenseUrl must not be provided`
        }
        return null;
    }

    @AfterValidate
    private static async runValidators(asset: Asset) {
        if (asset.isNewRecord) {
            await Asset.validatorCreation.parseAsync(asset);
        } else {
            await Asset.validator.parseAsync(asset);
        }
        let isNotValid = Asset.validateExtended(asset);
        if (isNotValid) {
            throw new Error(isNotValid);
        }
    }
    // #endregion

    public static async checkIfExists(id: number): Promise<boolean> {
        return await Asset.findByPk(id, { attributes: ['id'] }) ? true : false;
    }

    // #region Allowed to XYZ
    public canView(user?: User | null): boolean {
        let allowedStatuses = [Status.Verified, Status.Unverified];
        if (!user) {
            return allowedStatuses.includes(this.status);
        }

        return allowedStatuses.includes(this.status) || this.uploaderId === user.id;
    }


    public canEdit(user?: User | null): boolean {
        if (!user) {
            return false; // Only logged-in users can edit assets
        }

        // Users can edit their own assets
        return user.id === this.uploaderId || user.checkRoles([UserPermissions.Asset_EditAll], this.gameName);
    }
    // #endregion
    // #region Edits
    public static readonly protectedTags = [
        Tags.Featured,
        Tags.Contest,
    ];
    public async updateAsset(data: Partial<Pick<AssetInfer, 'name' | 'description' | 'tags'>>, user: User): Promise<Asset> {
        if (data.name) {
            this.name = data.name;
        }
        if (data.description) {
            this.description = data.description;
        }
        if (data.tags) {
            // get tags that are being added or removed
            let newTags = data.tags.filter(tag => !this.tags.includes(tag));
            let removedTags = this.tags.filter(tag => !data.tags!.includes(tag));
            // only allow adding/removing internal tags if user has permission
            if (
                newTags.some(tag => Asset.protectedTags.includes(tag)) ||
                removedTags.some(tag => Asset.protectedTags.includes(tag))
            ) {
                if (!user.checkRoles([UserPermissions.Asset_InternalTags], this.gameName)) {
                    throw new Error(`You do not have permission to add or remove internal tags.`);
                } else {
                    this.tags = data.tags;
                }
            } else {
                this.tags = data.tags;
            }
        }
        Logger.debug(`Updating asset ${this.id} with data: ${JSON.stringify(data)}`);
        return await this.save();
    }

    public async submitForApproval(reqBy: User): Promise<Asset> {
        if (this.status !== Status.Private) {
            throw new Error(`Only assets that are Private can be submitted for approval.`);
        }

        let allowBypass = true;
        switch (this.type) {
            case AssetFileFormat.Avatar_Avatar:
            case AssetFileFormat.Saber_Saber:
            case AssetFileFormat.Platform_Plat:
            case AssetFileFormat.Note_Bloq:
                allowBypass = false;
                break;
            default:
                allowBypass = true;
                break;
        }

        if (allowBypass) {
            Logger.log(`Asset ${this.id} submitted for approval by user ${reqBy.id}, auto-approving due to asset type.`);
            return this.setStatus(Status.Unverified, reqBy, `Auto-approved upon submission due to asset type.`, false);
        } else {
            Logger.log(`Asset ${this.id} submitted for approval by user ${reqBy.id}, sending to approval queue.`);
            return this.setStatus(Status.Pending, reqBy, `Submitted for approval.`, false);
        }
    }

    public async requestCollab(reqBy: User, userToCredit: User): Promise<ThingRequest> {
        if (this.uploaderId === userToCredit.id || this.collaborators.includes(userToCredit.id)) {
            throw new Error(`This user is already credited for this asset.`);
        }

        let existingRequests = await ThingRequest.findAll({
            where: {
                requestResponseBy: userToCredit.id,
                refrencedId: this.id,
                requestType: RequestType.Asset_Credit
            }
        });

        if (existingRequests.some(req => req.accepted === false)) {
            throw new Error(`This user has previously declined a credit request for this asset.`);
        }

        if (existingRequests.some(req => req.accepted === null)) {
            throw new Error(`This user has an open credit request for this asset.`);
        }

        Logger.log(`Creating credit request for asset ${this.id} by user ${reqBy.id} to credit user ${userToCredit.id}`);
        // note that alert is not needed as requests are treated like alerts
        return await ThingRequest.create({
            refrencedId: this.id,
            requesterId: reqBy.id,
            requestResponseBy: userToCredit.id,
            requestType: RequestType.Asset_Credit,
            objectToAdd: userToCredit.id,
        })
    }

    public async requestLink(reqBy: User, assetToLink: Asset, type: LinkedAssetLinkType) {
        if (this.id === assetToLink.id) {
            throw new Error(`You cannot link an asset to itself.`);
        }

        if (this.linkedIds.some(link => link.id === assetToLink.id)) {
            throw new Error(`This asset is already linked to the requested asset.`);
        }

        if (assetToLink.linkedIds.some(link => link.id === this.id)) {
            throw new Error(`This asset is already linked to the requested asset.`);
        }

        if (this.uploaderId !== assetToLink.uploaderId && !reqBy.checkRoles([UserPermissions.Asset_EditAll], this.gameName)) {
            let existingRequests = await ThingRequest.findAll({
                where: {
                    requestResponseBy: assetToLink.uploaderId,
                    refrencedId: this.id,
                    requestType: RequestType.Asset_Link
                }
            });
            if (existingRequests.some(req => req.accepted === false)) {
                throw new Error(`This user has previously declined a link request for this asset.`);
            }
            if (existingRequests.some(req => req.accepted === null)) {
                throw new Error(`This user has an open link request for this asset.`);
            }

            Logger.log(`Creating link request for asset ${this.id} by user ${reqBy.id} to link asset ${assetToLink.id}`);
            return await ThingRequest.create({
                refrencedId: this.id,
                requesterId: reqBy.id,
                requestResponseBy: assetToLink.uploaderId,
                requestType: RequestType.Asset_Link,
                objectToAdd: {
                    id: assetToLink.id,
                    linkType: type
                }
            });
        } else {
            Logger.log(`Directly linking asset ${this.id} to asset ${assetToLink.id} by user ${reqBy.id}`);
            return this.addLink(assetToLink, type);
        }
    }

    public async addLink(otherAsset: Asset, type: LinkedAssetLinkType): Promise<Asset> {
        if (this.linkedIds.some(link => link.id === otherAsset.id)) {
            throw new Error(`This asset is already linked to the requested asset.`);
        }

        if (this.id === otherAsset.id) {
            throw new Error(`You cannot link an asset to itself.`);
        }

        if (otherAsset.linkedIds.some(link => link.id === this.id)) {
            throw new Error(`This asset is already linked to the requested asset.`);
        }

        switch (type) {
            // Link to an older version of the asset
            case LinkedAssetLinkType.Older:
                this.linkedIds = [
                    ...this.linkedIds,
                    {
                        id: otherAsset.id,
                        linkType: LinkedAssetLinkType.Older
                    }
                ];
                otherAsset.linkedIds = [
                    ...otherAsset.linkedIds,
                    {
                        id: this.id,
                        linkType: LinkedAssetLinkType.Newer
                    }
                ];
                break;
            // Link to a newer version of the asset (e.g. this is older than the other asset)
            case LinkedAssetLinkType.Newer:
                this.linkedIds = [
                    ...this.linkedIds,
                    {
                        id: otherAsset.id,
                        linkType: LinkedAssetLinkType.Newer
                    }
                ];
                otherAsset.linkedIds = [
                    ...otherAsset.linkedIds,
                    {
                        id: this.id,
                        linkType: LinkedAssetLinkType.Older
                    }
                ];
                break;
            case LinkedAssetLinkType.AltFormat:
                this.linkedIds = [
                    ...this.linkedIds,
                    {
                        id: otherAsset.id,
                        linkType: LinkedAssetLinkType.AltFormat
                    }
                ];
                otherAsset.linkedIds = [
                    ...otherAsset.linkedIds,
                    {
                        id: this.id,
                        linkType: LinkedAssetLinkType.AltFormat
                    }
                ];
                break;
            case LinkedAssetLinkType.Alternate:
                this.linkedIds = [
                    ...this.linkedIds,
                    {
                        id: otherAsset.id,
                        linkType: LinkedAssetLinkType.Alternate
                    }
                ];
                otherAsset.linkedIds = [
                    ...otherAsset.linkedIds,
                    {
                        id: this.id,
                        linkType: LinkedAssetLinkType.Alternate
                    }
                ];
                break;
            default:
                throw new Error(`Invalid link type: ${type}`);
                break;
        }
        // Save both assets
        await this.save();
        await otherAsset.save();
        Logger.log(`Linked asset ${this.id} to asset ${otherAsset.id} as ${type}`);
        return this;
    }

    public async setStatus(newStatus: Status, userId: number | User, reason: string, sendAlert = true): Promise<Asset> {
        let userPreformingAction: User | null = null;
        let oldStatus = this.status;
        if (userId instanceof User) {
            userPreformingAction = userId;
        } else {
            userPreformingAction = await User.findByPk(userId);
            if (!userPreformingAction) {
                throw new Error(`User not found`);
            }
        }

        this.statusHistory = [...this.statusHistory, {
            status: newStatus,
            reason: reason,
            timestamp: new Date().toISOString(),
            userId: userPreformingAction.id, // User ID of the person who changed the status
        }];

        if (this.status === newStatus) {
            // No change in status, nothing to do
            return this.save();
        }

        let alertType = AlertType.Generic
        switch (newStatus) {
            case Status.Verified:
                alertType = AlertType.ThingVerified;
                Webhooks.sendWebhookLog(this.gameName, WebhookLogType.NewlyVerified, true, await WebhookPayloadGenerator.generatePublicNewAssetEmbedPayload(this));
                break;
            case Status.Unverified:
                Webhooks.sendWebhookLog(this.gameName, WebhookLogType.NewlyUnverified, true, WebhookPayloadGenerator.generateInternalStatusUpdateEmbedPayload(this, userPreformingAction, oldStatus, newStatus));
                break;
            case Status.Removed:
                if (oldStatus == Status.Verified || oldStatus == Status.Unverified) {
                    alertType = AlertType.ThingRemoval;
                } else if (oldStatus == Status.Pending) {
                    alertType = AlertType.ThingRejected;
                }
                break;
        }

        if (sendAlert) {
            Webhooks.sendWebhookLog(this.gameName, WebhookLogType.Text_StatusUpdate, true, WebhookPayloadGenerator.generateInternalStatusUpdateEmbedPayload(this, userPreformingAction, oldStatus, newStatus));
            this.alertUploader({
                type: alertType,
                header: `Asset Status Updated`,
                message: `The status of your asset ${this.name} has been changed to ${newStatus}${reason ? ` for the following reason: ${reason}` : `.`}`,
            });
        }
        this.status = newStatus;
        Logger.log(`Asset ${this.id} status changed to ${newStatus} by user ${userId} for reason: ${reason}`);
        return this.save();
    }
    // #endregion
    // #region Reports
    public async report(reportedBy: User, reason: string): Promise<ThingRequest> {
        if (this.uploaderId === reportedBy.id) {
            throw new Error(`You cannot report your own asset.`);
        }

        let existingRequests = await ThingRequest.findAll({
            where: {
                requestResponseBy: this.uploaderId,
                refrencedId: this.id,
                requestType: RequestType.Asset_Report
            }
        });

        if (existingRequests.some(req => req.accepted === null)) {
            throw new Error(`You have an open report request for this asset.`);
        }

        Logger.log(`Creating report request for asset ${this.id} by user ${reportedBy.id} for reason: ${reason}`);
        return await ThingRequest.create({
            refrencedId: this.id,
            requesterId: reportedBy.id,
            requestType: RequestType.Asset_Report,
            requestResponseBy: null,
            messages: [{
                userId: reportedBy.id,
                message: reason,
                timestamp: new Date(Date.now()).toISOString(),
            }],
        });
    }
    // #endregion
    // #region Misc
    public static convertNameToFileSafe(name: string, fallbackName?: string): string {
        name = name.trim();
        if (name.length === 0) {
            name = fallbackName ?? 'invalid_name';
        }
        if (name.length > 120) {
            name = name.substring(0, 120);
        }
        name = name.replaceAll(this.invalidFileNameChars, '_');
        name = name.replaceAll(this.invalidFileNameWin, '');
        return name;
    }

    public alertUploader(data: {
        type: AlertType;
        header: string;
        message: string;
    }): Promise<Alert> {
        return Alert.create({
            type: data.type,
            userId: this.uploaderId,
            assetId: this.id,
            header: data.header,
            message: data.message,
        });
    }
    // #endregion Misc
    // #region API Responses
    public async toApiV3(includeAuthor: boolean = true): Promise<AssetApiV3> {
        let author;
        let authorApi: UserApiV3 | null = null;

        if (includeAuthor) {
            author = await this.uploader;
            if (!author) {
                authorApi = {
                } as User; // Fallback to a default user if not found
            } else {
                authorApi = author.toApiV3();
            }
        }

        return {
            id: this.id,
            oldId: this.oldId,
            linkedIds: this.linkedIds,
            type: this.type,
            uploaderId: this.uploaderId,
            uploader: authorApi,
            name: this.name,
            description: this.description,
            license: this.license,
            licenseUrl: this.licenseUrl,
            sourceUrl: this.sourceUrl,
            icons: this.iconNames,
            fileHash: this.fileHash,
            fileSize: this.fileSize,
            fileSafeName: this.fileSafeName,
            //fileroute has the / inlcuded, so no need to add another /
            downloadUrl: `${EnvConfig.server.backendUrl}${EnvConfig.server.fileRoute}/${this.id}/${this.assetFileName}`,
            status: this.status,
            statusHistory: this.statusHistory,
            collaborators: this.collaborators,
            tags: this.tags,
            createdAt: this.createdAt,
            updatedAt: this.updatedAt
        }
    }

    public async toApiV2(): Promise<AssetPublicAPIv2> {
        let author = await this.uploader;
        let type: `avatar` | `saber` | `platform` | `bloq` = `avatar`;
        switch (this.type.split('_')[0]) {
            case `avatar`:
                type = 'avatar';
                break;
            case `saber`:
                type = 'saber';
                break;
            case `platform`:
                type = 'platform';
                break;
            case `note`:
                type = 'bloq';
                break;
        }

        return {
            type: type,
            tags: this.tags,
            name: this.name,
            author: author ? author.displayName : 'Unknown',
            bsaber: ``,
            hash: this.fileHash,
            id: this.id,
            discord: author ? author.username : 'Unknown',
            discordid: author?.discordId ? author.discordId : '-1',
            install_link: `modelsaber://${type}/${this.id}/${this.assetFileName}`,
            download: `${EnvConfig.server.backendUrl}/${EnvConfig.server.fileRoute}/asset/${this.assetFileName}`,
            status: this.status,
            platform: `pc`,
            variationid: null,
            thumbnail: this.iconNames[0],
            date: this.createdAt.toUTCString(),
        }
    }

    public async toApiV1(): Promise<AssetPublicAPIv1> {
        let apiV2Response = await this.toApiV2();

        return {
            tags: apiV2Response.tags,
            type: apiV2Response.type,
            name: apiV2Response.name,
            author: apiV2Response.author,
            hash: apiV2Response.hash,
            bsaber: apiV2Response.bsaber,
            download: apiV2Response.download,
            image: `${EnvConfig.server.backendUrl}/${EnvConfig.server.fileRoute}/thumb/${this.iconNames[0]}`,
            install_link: apiV2Response.install_link,
            date: apiV2Response.date,
        }
    }

    public async toApiResponse(): Promise<AssetApiV3> {
        return this.toApiV3();
    }
    // #endregion
}