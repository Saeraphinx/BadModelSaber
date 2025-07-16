import { DatabaseManager } from "../Database.ts";

export type UserPublicAPIv3 = {
    id: string;
    username: string;
    displayName: string | null;
    bio: string | null;
    sponsorUrl: string | null;
    roles: UserRole[];
}

export type AssetPublicAPIv2 = {
    tags: string[];
    type: string;
    name: string;
    author: string;
    thumbnail: string;
    hash: string;
    bsaber: string; // empty if not available
    status: string;
    discordId: string; // "-1" if not available
    discord: string; // username
    variationId: string | null; // null if not a variation
    platform: `pc`,
    download: string; // download URL
    install_link: string; // install link URL - "modelsaber://${type}/${id}/${filename}.${fileFormat}"
    date: string; // date in 2018-12-29 06:35:39 UTC format
}

export type AssetPublicAPIv1 = Pick<AssetPublicAPIv2, `tags` | `type` | `name` | `author` | `hash` | `bsaber` | `download` | `install_link` | `date`> & {
    image: string; // thumbnail full URL
}


export type AssetPublicAPIv3 = {
    id: number;
    oldId: string | null;
    linkedIds: LinkedAsset[]; // Array of linked asset IDs
    type: AssetType;
    fileFormat: AssetFileFormat;
    author: UserPublicAPIv3;
    name: string;
    description: string;
    license: string; // e.g. CC-BY, CC0, etc. or 'custom'
    licenseUrl: string | null;
    sourceUrl: string | null;
    fileHash: string;
    fileSize: number;
    status: Status;
    statusHistory: StatusHistory[];
    tags: string[];
    createdAt: Date;
    updatedAt: Date;
}

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

    ChromaEnv_JSON = 'chroma-environment_json',
    Camera2Config_JSON = 'camera2-config_json',
    CountersPlusConfig_JSON = 'counters-plus-config_json',
    HSVConfig_JSON = 'hitscorevisualizer-config_json',
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

// #region Alert & Reqeust & User Enums
export enum UserRole {
    Admin = "admin", // Admins have permission to manage users & potentially other sensitive operations
    Developer = "developer", // Developers are able to view everything for development purposes.
    Moderator = "moderator", // Moderators can approve & delete assets
    Trusted = "trusted", // This role has no special permissions at this point in time.
    BSMG = "bsmg", // This role is for BSMG staff, and has no special permissions at this point in time.
    Banned = "banned", // Banned users cannot create assets, comment, or upload files. 
}
export enum AlertType {
    AssetApproved = "asset_approved", // Alert when an asset is approved
    AssetRejected = "asset_rejected", // Alert when an asset is rejected
    AssetRemoval = "asset_removal", // Alert when an asset is removed
    Request = "request", // Alert for asset requests
}

export enum RequestType {
    Credit = "credit", // Request to credit the user for an asset
    Link = "link", // Request to add an asset to linkedIds that the author is not the uploader of
    Report = "report", // Request to report an asset for a specific reason
}
// #endregion Alert Enums
export class DatabaseHelper {
    public static db: DatabaseManager;

    constructor(db: DatabaseManager) {
        DatabaseHelper.db = db;
    }
}
