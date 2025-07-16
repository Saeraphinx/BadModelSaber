import { z } from "zod/v4";

import fileUpload from "express-fileupload";
import { AssetFileFormat, AssetType, Status } from "./database/DBExtras.ts";
import { Asset } from "./database/tables/Asset.ts";

export class Validator {
    public static z = z;
    public static zNumberID = z.number().int().positive();
    public static zAssetType =  z.enum(AssetType);
    public static zAssetFileFormat = z.enum(AssetFileFormat);
    public static zAssetStatus = z.enum(Status);

    public static zCreateAssetv3 = Asset.validator.pick({
        type: true,
        fileFormat: true,
        name: true,
        description: true,
        license: true,
        licenseUrl: true,
        sourceUrl: true,
        tags: true,
    });

    public static zFilterAssetv3 = z.object({
        type: Validator.zAssetType.optional(),
        fileFormat: Validator.zAssetFileFormat.optional(),
        status: Validator.zAssetStatus.optional(),
        tags: z.array(z.string()).optional(),
        page: z.coerce.number().int().min(1).optional(),
        limit: z.coerce.number().int().min(1).max(250).optional(),
    }).refine((data) => {
        if (data.page || data.limit) {
            if (!data.page || !data.limit) {
                return false; // If one is provided, both must be provided
            }
        }
        return true; // Valid if both are provided or neither is provided
    }, `Both page and limit must be provided together.`);

    public static zApprovalObjv3 = z.object({
        status: Validator.zAssetStatus,
        reason: z.string().max(320).optional().default(`No reason provided.`),
    });

    public static zAssetIdArray = z.array(Validator.zNumberID);

    public static validateThumbnail(file: fileUpload.UploadedFile) {
        let isAcceptableImage =
            ((file.mimetype === `image/png` && file.name.endsWith(`.png`)) ||
                (file.mimetype === `image/jpeg` && file.name.endsWith(`.jpg`)) ||
                (file.mimetype === `image/gif` && file.name.endsWith(`.gif`)) ||
                (file.mimetype === `image/webp` && file.name.endsWith(`.webp`)));

        return isAcceptableImage
    }

    public static validateAssetFile(file: fileUpload.UploadedFile, type: AssetFileFormat): boolean {
        let typeFileExtension = type.split(`_`)[1].toLowerCase();
        switch (type) {
            // PC assets
            case AssetFileFormat.Saber_Saber:
            case AssetFileFormat.Avatar_Avatar:
            case AssetFileFormat.Platform_Plat:
            case AssetFileFormat.Note_Bloq:
            case AssetFileFormat.Wall_Pixie:
            case AssetFileFormat.HealthBar_Energy:
                return file.mimetype === `application/octet-stream` && file.name.endsWith(`.${typeFileExtension}`);
            // Quest/PC assets
            case AssetFileFormat.Saber_Wacker:
            case AssetFileFormat.Note_Cyoob:
            case AssetFileFormat.Wall_Box:
                return (file.mimetype === `application/zip` || file.mimetype === `application/x-zip-compressed`) && file.name.endsWith(`.${typeFileExtension}`);
            // Sound assets
            case AssetFileFormat.Sound_Ogg:
                return file.mimetype === `audio/ogg` && file.name.endsWith(`.${typeFileExtension}`);
            case AssetFileFormat.Sound_Mp3:
                return file.mimetype === `audio/mpeg3` && file.name.endsWith(`.${typeFileExtension}`);
            // Banner assets
            case AssetFileFormat.Banner_Png:
                return file.mimetype === `image/png` && file.name.endsWith(`.${typeFileExtension}`);
            // JSON assets
            case AssetFileFormat.ChromaEnv_JSON:
            case AssetFileFormat.CountersPlusConfig_JSON:
            case AssetFileFormat.HSVConfig_JSON:
            case AssetFileFormat.Camera2Config_JSON:
                return file.mimetype === `application/json` && file.name.endsWith(`.${typeFileExtension}`);
            default:
                return false; // Invalid asset type
        }
    }

}


