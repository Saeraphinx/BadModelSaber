import { InferAttributes, Model, InferCreationAttributes, NonAttribute, CreationOptional } from "sequelize";
import { User, UserRole } from "../../Database.ts";
import { AssetPublicAPIv1, AssetPublicAPIv2, AssetPublicAPIv3, DatabaseHelper, UserPublicAPIv3 } from "../DBExtras.ts";
import { z } from "zod/v4";
import { Validator } from "../../Validator.ts";
import { EnvConfig } from "../../../shared/EnvConfig.ts";

// #region Asset Enums
export enum AssetType {
    Avatar = 'avatar',
    Saber = 'saber',
    Platform = 'platform',
    Note = 'note',
    Wall = 'wall',
    HealthBar = 'health-bar',
    Sound = 'sound',
    Banner = 'banner',

    ChromaEnvironment = 'chroma-environment',
    Camera2Config = 'camera2-config',
    CountersPlusConfig = 'counters-plus-config',
    HSVConfig = 'hitscorevisualizer-config',
}

export enum AssetFileFormat {
    // sabers
    Saber_Wacker = 'saber_wacker',
    Saber_Saber = 'saber_saber',

    Avatar_Avatar = 'avatar_avatar',

    Platform_Plat = 'platform_plat',

    Note_Bloq = 'note_bloq',
    Note_Cyoob = 'note_cyoob',

    Wall_Pixie = 'wall_pixie',
    Wall_Box = 'wall_box',

    HealthBar_Energy = 'health-bar_energy',

    Sound_Ogg = 'sound_ogg',
    Sound_Mp3 = 'sound_mp3',

    Banner_Png = 'banner_png',

    JSON = 'json_json',
}
    
export enum Status {
    Private = 'private',
    Pending = 'pending',
    Approved = 'approved',
    Rejected = 'rejected',
}

export enum License {
    CC0 = "cc0-1.0",
    CC40_BY = "cc4.0-by",
    CC40_BY_SA = "cc4.0-by-sa",
    CC40_BY_ND = "cc4.0-by-nd",
    CC40_BY_NC = "cc4.0-by-nc",
    CC40_BY_NC_SA = "cc4.0-by-nc-sa",
    CC40_BY_NC_ND = "cc4.0-by-nc-nd",
    Custom = "custom"
}

export type StatusHistory = {
    status: Status;
    reason: string;
    timestamp: Date;
    userId: string; // User ID of the person who changed the status
};

export interface LinkedAsset {
    id: number;
    linkType: LinkedAssetLinkType;
}

export enum LinkedAssetLinkType {
    Older = 'older', // e.g. a newer version of the asset
    Newer = 'newer', // e.g. an older version of the asset
    AltFormat = 'altFormat', // e.g. a different format of the same asset (e.g. .saber and .wacker)
    Alternate = 'alternate', // e.g. an alternate version of the asset (e.g. a different color scheme)
}

export interface Credit { // ${workDone} by ${userId.username}
    userId: string; // User ID of the person credited
    workDone: string; // Description of the work done by the user
}

export enum SystemTags {
    CustomColors = 'custom-colors',
    CustomTrails = 'custom-trails',
    CustomBombs = 'custom-bombs',
    CustomArrows = 'custom-arrows',
    Reactive = 'reactive',
    AudioLink = 'AudioLink',
    Thin = 'thin',
    FBT = 'fbt',
    Cloth = 'cloth',
    DynamicBones = 'dynamic-bones',
    EQ = 'eq',
    FirstPersonCompatible = 'first-person-compatible',
    ShaderReplacement = 'shader-replacement',
    NSFW = 'nsfw',
}
// #endregion Asset Enums

export type AssetInfer = InferAttributes<Asset>;
export class Asset extends Model<InferAttributes<Asset>, InferCreationAttributes<Asset>> {
    declare readonly id: CreationOptional<number>;
    declare oldId: CreationOptional<string | null>; // id from modelsaber, if applicable
    declare linkedIds: CreationOptional<LinkedAsset[]>; // models that are linked to this asset, e.g. a pc .saber may have a linked .wacker, or a model may have a newer version that is linked to it

    declare type: AssetType;
    declare fileFormat: AssetFileFormat;

    declare uploaderId: string; // User ID of the uploader, this is not the author, but the person who uploaded the asset to the platform
    declare credits: CreationOptional<Credit[]>; // credits for the asset, e.g. "Model by John Doe, Textures by Jane Smith"
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
    declare tags: CreationOptional<string[]>; // system defined tags

    declare readonly createdAt: CreationOptional<Date>;
    declare readonly updatedAt: CreationOptional<Date>;
    declare readonly deletedAt: CreationOptional<Date | null>;

    get uploader(): NonAttribute<Promise<User | null>> {
        return DatabaseHelper.db.Users.findByPk(this.uploaderId); // This should be replaced with a User object in the actual implementation
    }

    get fileName(): NonAttribute<string> {
        return `${this.fileHash}.${this.fileFormat.split('_')[1]}`; // e.g. ".saber"
    }

    public static validator = z.object({
        // unique by db
        id: Validator.zNumberID,
        // unique by db
        oldId: z.string().nullable(),
        linkedIds: z.array(z.object({
            id: z.number().refine(async (id) => await Asset.checkIfExists(id)),
            linkType: z.enum(['older', 'newer', 'altFormat']),
        })),
        type: z.enum(AssetType),
        fileFormat: z.enum(AssetFileFormat),
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
        tags: z.array(z.string().min(1).max(50)),
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

    public static async checkIfExists(id: number): Promise<boolean> {
        return await Asset.findByPk(id, {attributes: ['id']}) ? true : false;
    }

    public canView(user: User | undefined): boolean {
        if (!user) {
            return this.status === Status.Approved || this.status === Status.Pending;
        }

        if (this.status === Status.Private || this.status === Status.Rejected) {
            // If the asset is private, only the uploader can view it
            return user.id === this.uploaderId || 
            user.roles.includes(UserRole.Admin) || 
            user.roles.includes(UserRole.Moderator) || 
            user.roles.includes(UserRole.Developer);
        }

        // If the user is logged in, they can view all assets
        return this.status === Status.Approved || this.status === Status.Pending;
    }

    public static allowedToViewRoles(user: User|undefined): Status[] {
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
        

    public canEdit(user: User | null): boolean {
        if (!user) {
            return false; // Only logged-in users can edit assets
        }

        // Users can edit their own assets, or if they are an admin, developer, or moderator
        return user.id === this.uploaderId || 
            user.roles.includes(UserRole.Admin) || 
            user.roles.includes(UserRole.Moderator);
    }

    public async setStatus(newStatus: Status, reason: string, userId: string): Promise<Asset> {
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
            fileFormat: this.fileFormat,
            author: authorApi,
            name: this.name,
            description: this.description,
            license: this.license,
            licenseUrl: this.licenseUrl,
            sourceUrl: this.sourceUrl,
            fileHash: this.fileHash,
            fileSize: this.fileSize,
            status: this.status,
            statusHistory: this.statusHistory,
            tags: this.tags,
            createdAt: this.createdAt,
            updatedAt: this.updatedAt
        }
    }

    public async getApiV2Response(): Promise<AssetPublicAPIv2> {
        let author = await this.uploader;
        let type : `avatar` | `saber` | `platform` | `bloq` = `avatar`;
        switch (this.type) {
            case AssetType.Avatar:
                type = 'avatar';
                break;
            case AssetType.Saber:
                type = 'saber';
                break;
            case AssetType.Platform:
                type = 'platform';
                break;
            case AssetType.Note:
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
            download: `${EnvConfig.server.baseUrl}/${EnvConfig.server.fileRoute}/asset/${this.fileName}`,
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
            image: `${EnvConfig.server.baseUrl}/${EnvConfig.server.fileRoute}/thumb/${this.iconNames[0]}`,
            install_link: apiV2Response.install_link,
            date: apiV2Response.date,
        }
    }

    public async getApiResponse(): Promise<AssetPublicAPIv3> {
        return this.getApiV3Response();
    }
}