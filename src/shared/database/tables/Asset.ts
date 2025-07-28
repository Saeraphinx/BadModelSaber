import { InferAttributes, Model, InferCreationAttributes, NonAttribute, CreationOptional } from "sequelize";
import { Alert, AssetRequest, User, UserRole } from "../../Database.ts";
import { AlertType, AssetFileFormat, AssetPublicAPIv1, AssetPublicAPIv2, AssetPublicAPIv3, License, LinkedAsset, LinkedAssetLinkType, RequestType, Status, StatusHistory, Tags, UserPublicAPIv3 } from "../DBExtras.ts";
import { z } from "zod/v4";
import { EnvConfig } from "../../../shared/EnvConfig.ts";
import { ca } from "zod/v4/locales";

export type AssetInfer = InferAttributes<Asset>;
export class Asset extends Model<InferAttributes<Asset>, InferCreationAttributes<Asset>> {
    declare readonly id: CreationOptional<number>;
    declare oldId: CreationOptional<string | null>; // id from modelsaber, if applicable
    declare linkedIds: CreationOptional<LinkedAsset[]>; // models that are linked to this asset, e.g. a pc .saber may have a linked .wacker, or a model may have a newer version that is linked to it

    declare type: AssetFileFormat;

    declare uploaderId: string; // User ID of the uploader, this is not the author, but the person who uploaded the asset to the platform
    declare collaborators: CreationOptional<string[]>; // credits for the asset, e.g. "Model by John Doe, Textures by Jane Smith"
    declare name: string;
    declare description: string;
    declare license: License; // e.g. CC-BY, CC0, etc. or 'custom'
    declare licenseUrl: CreationOptional<string | null>; // URL to the license, if applicable (e.g. custom is set for license)
    declare sourceUrl: CreationOptional<string | null> // URL to the source of the asset, if applicable;
    declare fileHash: string;
    declare fileSize: number;
    declare iconNames: string[]; // names of the icons associated with the asset, e.g. ["icon1.png", "icon2.png"]
    declare status: CreationOptional<Status>;
    declare statusHistory: CreationOptional<StatusHistory[]>;
    declare tags: CreationOptional<Tags[]>; // system defined tags

    declare readonly createdAt: CreationOptional<Date>;
    declare readonly updatedAt: CreationOptional<Date>;
    declare readonly deletedAt: CreationOptional<Date | null>;

    get uploader(): NonAttribute<Promise<User | null>> {
        return User.findByPk(this.uploaderId); // This should be replaced with a User object in the actual implementation
    }

    get fileName(): NonAttribute<string> {
        return `${this.fileHash}.${this.type.split('_')[1]}`; // e.g. ".saber"
    }

    // #region Validators
    public static validator = z.object({
        // unique by db
        id: z.number().int().positive(),
        // unique by db
        oldId: z.string().nullable(),
        linkedIds: z.array(z.object({
            id: z.number().refine(async (id) => await Asset.checkIfExists(id)),
            linkType: z.enum(['older', 'newer', 'altFormat']),
        })),
        type: z.enum(AssetFileFormat),
        uploaderId: z.string().refine(async (id) => await User.checkIfExists(id)),
        credits: z.array(z.object({
            userId: z.string().refine(async (id) => await User.checkIfExists(id)),
            workDone: z.string().min(1).max(64),
        })),
        name: z.string().min(1).max(255),
        description: z.string().max(4096),
        license: z.enum(Object.values(License)),
        licenseUrl: z.url().nullable(),
        sourceUrl: z.url().nullable(),
        // unique by db
        fileHash: z.string().min(1).max(64),
        fileSize: z.number().int().positive(),
        status: z.enum(Status),
        statusHistory: z.array(z.object({
            status: z.enum(Status),
            reason: z.string().max(512),
            timestamp: z.date(),
            userId: z.string().refine(async (id) => await User.checkIfExists(id)), // User ID of the person who changed the status
        })),
        tags: z.array(z.enum(Tags)).max(5).default([]),
        createdAt: z.date(),
        updatedAt: z.date(),
        deletedAt: z.date().nullable().optional(),
    }).refine(async (data) => {
        if (data.license === 'custom' && !data.licenseUrl) {
            return false; // If license is custom, licenseUrl must be provided
        } else if (data.license !== 'custom' && data.licenseUrl) {
            return false; // If license is not custom, licenseUrl must not be provided
        }
        return true;
    }, {
        message: "If license is 'custom', licenseUrl must be provided.",
    });

    // This validator is used for creating new assets, it omits the id and timestamps and other fields that are marked as CreationOptional
    public static createValidator = z.object({
        ...Asset.validator.shape,
        id: Asset.validator.shape.id.nullish(),
        oldId: Asset.validator.shape.oldId.nullish(),
        linkedIds: Asset.validator.shape.linkedIds.nullish(),
        credits: Asset.validator.shape.credits.nullish(),
        licenseUrl: Asset.validator.shape.licenseUrl.nullish(),
        sourceUrl: Asset.validator.shape.sourceUrl.nullish(),
        createdAt: Asset.validator.shape.createdAt.nullish(),
        updatedAt: Asset.validator.shape.updatedAt.nullish(),
        deletedAt: Asset.validator.shape.deletedAt.nullish(),
    })
    // #endregion

    public static async checkIfExists(id: number): Promise<boolean> {
        return await Asset.findByPk(id, { attributes: ['id'] }) ? true : false;
    }

    // #region Allowed to XYZ
    public static allowedToViewRoles(user: User | undefined | null): Status[] {
        if (!user) {
            return [Status.Approved, Status.Pending]
        }

        if (user.roles.includes(UserRole.Admin) ||
            user.roles.includes(UserRole.Moderator) ||
            user.roles.includes(UserRole.Developer)) {
            return [Status.Approved, Status.Pending, Status.Private, Status.Rejected];
        }

        // If the user is logged in, they can view all approved and pending assets (same as unlogged-in users)
        return [Status.Approved, Status.Pending];
    }

    public canView(user: User | undefined): boolean {
        if (!user) {
            return this.status === Status.Approved || this.status === Status.Pending;
        }

        let allowedStatuses = Asset.allowedToViewRoles(user);
        return allowedStatuses.includes(this.status) || this.uploaderId === user.id;
    }


    public canEdit(user: User | null): boolean {
        if (!user) {
            return false; // Only logged-in users can edit assets
        }

        // Users can edit their own assets, or if they are an admin, developer, or moderator
        return user.id === this.uploaderId ||
            user.roles.includes(UserRole.Admin) ||
            user.roles.includes(UserRole.Moderator);
    }
    // #endregion
    // #region Edits
    public updateAsset(data: Partial<Pick<AssetInfer, 'name' | 'description'>>): Promise<Asset> {
        if (data.name) {
            this.name = data.name;
        }
        if (data.description) {
            this.description = data.description;
        }

        return this.save();
    }

    public async requestCollab(reqBy: User, userToCredit: User): Promise<AssetRequest> {
        if (this.uploaderId === userToCredit.id || this.collaborators.includes(userToCredit.id)) {
            throw new Error(`This user is already credited for this asset.`);
        }

        let existingRequests = await AssetRequest.findAll({
            where: {
                requestResponseBy: userToCredit.id,
                refrencedAssetId: this.id,
                requestType: RequestType.Credit
            }
        });

        if (existingRequests.some(req => req.accepted === false)) {
            throw new Error(`This user has previously declined a credit request for this asset.`);
        }

        if (existingRequests.some(req => req.accepted === null)) {
            throw new Error(`This user has an open credit request for this asset.`);
        }

        return await AssetRequest.create({
            refrencedAssetId: this.id,
            requesterId: reqBy.id,
            requestResponseBy: userToCredit.id,
            requestType: RequestType.Credit,
            objectToAdd: userToCredit.id,
        });
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

        if (this.uploaderId !== assetToLink.uploaderId || reqBy.roles.includes(UserRole.Admin) || reqBy.roles.includes(UserRole.Moderator)) {
            let existingRequests = await AssetRequest.findAll({
                where: {
                    requestResponseBy: assetToLink.uploaderId,
                    refrencedAssetId: this.id,
                    requestType: RequestType.Link
                }
            });
            if (existingRequests.some(req => req.accepted === false)) {
                throw new Error(`This user has previously declined a link request for this asset.`);
            }
            if (existingRequests.some(req => req.accepted === null)) {
                throw new Error(`This user has an open link request for this asset.`);
            }
            return await AssetRequest.create({
                refrencedAssetId: this.id,
                requesterId: reqBy.id,
                requestResponseBy: assetToLink.uploaderId,
                requestType: RequestType.Link,
                objectToAdd: {
                    id: assetToLink.id,
                    linkType: type
                }
            });
        } else {
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
        return this;
    }

    public async setStatus(newStatus: Status, reason: string, userId: string, sendAlert = true): Promise<Asset> {
        this.statusHistory.push({
            status: newStatus,
            reason: reason,
            timestamp: new Date(),
            userId: userId, // User ID of the person who changed the status
        });

        if (this.status === newStatus) {
            // No change in status, nothing to do
            return this.save();
        }

        switch (this.status) {
            case Status.Rejected:
            case Status.Private:
                break;
            case Status.Pending:
                if (newStatus !== Status.Approved) {
                    // rejected from queue
                    break;
                } else {
                    // approved from queue
                }
                break;
            case Status.Approved:
                if (newStatus !== Status.Approved) {
                    // verification revoked
                    break;
                }
            default:
                throw new Error(`Invalid status transition from ${this.status} to ${newStatus}`);
        }
        this.status = newStatus;
        return this.save();
    }
    // #endregion
    // #region Misc
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
    public async getApiV3Response(): Promise<AssetPublicAPIv3> {
        let author = await this.uploader;
        let authorApi: UserPublicAPIv3;

        if (!author) {
            authorApi = {
            } as User; // Fallback to a default user if not found
        } else {
            authorApi = author.getApiResponse();
        }

        return {
            id: this.id,
            oldId: this.oldId,
            linkedIds: this.linkedIds,
            type: this.type,
            uploader: authorApi,
            name: this.name,
            description: this.description,
            license: this.license,
            licenseUrl: this.licenseUrl,
            sourceUrl: this.sourceUrl,
            icons: this.iconNames,
            fileHash: this.fileHash,
            fileSize: this.fileSize,
            status: this.status,
            statusHistory: this.statusHistory,
            collaborators: this.collaborators,
            tags: this.tags,
            createdAt: this.createdAt,
            updatedAt: this.updatedAt
        }
    }

    public async getApiV2Response(): Promise<AssetPublicAPIv2> {
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
            discord: author ? author.username : 'Unknown',
            discordId: author ? author.id : '-1',
            install_link: `modelsaber://${type}/${this.id}/${this.fileName}`,
            download: `${EnvConfig.server.backendUrl}/${EnvConfig.server.fileRoute}/asset/${this.fileName}`,
            status: this.status,
            platform: `pc`,
            variationId: null,
            thumbnail: this.iconNames[0],
            date: this.createdAt.toUTCString(),
        }
    }

    public async getApiV1Response(): Promise<AssetPublicAPIv1> {
        let apiV2Response = await this.getApiV2Response();

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

    public async getApiResponse(): Promise<AssetPublicAPIv3> {
        return this.getApiV3Response();
    }
    // #endregion
}