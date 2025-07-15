import { Asset, AssetFileFormat, Status, AssetType, DatabaseManager, LinkedAsset, StatusHistory, UserRole as UserRole } from "../Database.ts";

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

export class DatabaseHelper {
    public static db: DatabaseManager;

    constructor(db: DatabaseManager) {
        DatabaseHelper.db = db;
    }
}
