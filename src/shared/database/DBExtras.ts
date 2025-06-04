import { Asset, AssetFileFormat, Status, AssetType, DatabaseManager, LinkedAsset, StatusHistory, UserRole as UserRole } from "../Database.ts";

export type UserPublicAPI = {
    id: string;
    username: string;
    displayName: string | null;
    bio: string | null;
    sponsorUrl: string | null;
    roles: UserRole[];
}

export type AssetPublicAPI = {
    id: number;
    oldId: string | null;
    linkedIds: LinkedAsset[]; // Array of linked asset IDs
    type: AssetType;
    fileFormat: AssetFileFormat;
    author: UserPublicAPI;
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
