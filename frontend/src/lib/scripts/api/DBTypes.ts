export enum SponsorType {
    GitHub = "github",
    KoFi = "ko-fi",
    Patreon = "patreon",
}

export type SponserUrl = {
    platform: SponsorType;
    url: string;
}

export type UserPublicAPIv3 = {
    id: string;
    username: string;
    displayName: string;
    bio: string | null;
    sponsorUrl: SponserUrl[] | null;
    avatarUrl: string;
    roles: UserPermissions[];
}

export type AlertPublicAPIv3 = {
    id: number;
    type: AlertType;
    assetId: number | null;
    requestId: number | null;
    header: string;
    message: string;
    read: boolean;
    createdAt: Date;
    updatedAt: Date;
};

export type AssetRequestPublicAPIv3 = {
    id: number;
    refrencedAssetId: number;
    refrencedAsset: AssetPublicAPIv3 | null;
    requesterId: string;
    requester: UserPublicAPIv3 | null;
    requestResponseBy: string | null;
    requestType: RequestType;
    accepted: boolean | null;
    messages: RequestMessage[];
    resolvedBy: string | null;
    createdAt: Date;
    updatedAt: Date;
}

export type AssetPublicAPIv2 = {
    tags: string[];
    type: string;
    name: string;
    author: string;
    thumbnail: string;
    id: number
    hash: string;
    bsaber: string; // empty if not available
    status: string;
    discordid: string; // "-1" if not available
    discord: string; // username
    variationid: number | null; // null if not a variation
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
    oldId: number | null;
    linkedIds: LinkedAsset[]; // Array of linked asset IDs
    type: AssetFileFormat;
    uploaderId: string; // User ID of the uploader
    uploader: UserPublicAPIv3 | null;
    icons: string[]; // Array of icon names
    name: string;
    description: string;
    license: string; // e.g. CC-BY, CC0, etc. or 'custom'
    licenseUrl: string | null;
    sourceUrl: string | null;
    fileHash: string;
    fileSize: number;
    status: Status;
    statusHistory: StatusHistory[];
    collaborators: string[];
    tags: string[];
    createdAt: Date;
    updatedAt: Date;
}

// #region Asset Enums
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

export enum Tags {
    // features
    CustomColors = 'Custom Colors', // all really
    CustomTrails = 'Custom Trails', //sabers
    CustomBombs = 'Custom Bombs', // notes
    CustomArrows = 'Custom Arrows', // notes

    AudioLink = 'AudioLink', // sabers
    Reactive = 'Reactive', // sabers/platforms
    Animations = 'Animations', // sabers/platforms
    Sounds = 'Sounds', // sabers/platforms w/ audio

    FBT = 'FBT', // asset
    Cloth = 'Cloth',
    DynamicBones = 'Dynamic Bones',
    Shaders = 'Shader Replacement',
    NSFW = 'NSFW',

    // types/genres
    Meme = 'Meme',
    Thin = 'Thin', // sabers
    Large = 'Large', // sabers
    Acc = 'Acc',
    Particles = 'Particles', // sabers
    Sword = 'Sword', // sabers
    Simple = 'Simple', // sabers
    VideoGame = 'Video Game',
    Anime = 'Anime',
    Pride = 'Pride',
    Pro = 'Pro',
    Halloween = 'Halloween',
    Holiday = 'Holiday',
    Christmas = 'Christmas',

    Underswing = 'Underswing', // hsv
    TimeDependence = 'Time Dependence', // hsv
    Hitsound = 'Hitsound', // sounds
    BadHitsound = 'BadCut Hitsound', // sounds
    MenuClick = 'Menu Click', // sounds
    FirstPerson = 'First Person', // camera2
    ThirdPerson = 'Third Person', // camera2

    Contest = 'Contest',
}
// #endregion Asset Enums

// #region Alert & Reqeust & User Enums
export enum UserPermissions {
    // actual permissions
    View_Pending_Assets = "view_pending_assets", // User can view & search pending assets
    View_All_Assets = "view_all_assets", // User can view & search all assets, including private ones
    Approve_Assets = "approve_assets", // User can approve/reject pending assets
    Edit_Any_Asset = "edit_any_asset", // User can edit any asset, regardless of ownership

    View_All_Reports = "view_all_reports", // User can view all asset reports
    Manage_All_Reports = "manage_all_reports", // User can manage (resolve) asset reports

    Manage_NonMod_Users = "manage_nonmod_users", // User can manage non-admin users (e.g. ban users)
    Manage_All_Users = "manage_all_users", // User can manage admin users w/o restrictions
    Create_Assets = "create_assets", // User can upload/create asset


    // cosmetic roles for badges only
    C_Developer = "cos_developer", // User is a developer of the site
    C_Moderator = "cos_moderator", // User is a moderator of the site
    C_Admin = "cos_admin", // User is an admin of the site
    C_BSMG_Staff = "cos_bsmg_staff", // User is a member of the BSMG staff
    C_Modeler = "cos_modeler", // User is a recognized modeler on ModelSaber

}
export enum AlertType {
    Generic = "generic", // Generic alert type, used for non-specific alerts
    AssetApproved = "asset_approved", // Alert when an asset is approved
    AssetRejected = "asset_rejected", // Alert when an asset is rejected
    AssetRemoval = "asset_removal", // Alert when an asset is removed
    RequestAccepted = "request_accepted", // Alert when a request is accepted
    RequestDeclined = "request_declined", // Alert when a request is declined
}

export enum RequestType {
    Credit = "credit", // Request to credit the user for an asset
    Link = "link", // Request to add an asset to linkedIds that the author is not the uploader of
    Report = "report", // Request to report an asset for a specific reason
}
// #endregion Alert Enums

export interface RequestMessage {
    userId: string; // User ID of the person who sent the message
    message: string; // The message content
    timestamp: Date; // Timestamp of when the message was sent
}