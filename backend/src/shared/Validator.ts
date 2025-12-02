import { z } from "zod/v4";

import { AssetFileFormat, Status, Tags } from "./database/DBExtras.ts";
import { Asset } from "./database/tables/Asset.ts";
import jszip from "jszip";
import { parseErrorMessage } from "./Tools.ts";

export class Validator {
    public static z = z;
    public static zBool = z.preprocess((input) => {
        if (typeof input === `string`) {
            if (input.toLowerCase() === `true`) return true;
        }
        if (typeof input === `number`) {
            if (input >= 1) return true;
        }
        if (typeof input === `boolean`) return input;
        return false; // Default to false if not a boolean or string
    }, z.boolean());
    public static zNumberId = z.number().int().positive();
    /**
     * @deprecated Use z.number().int().positive() instead
     */
    public static zNumberIDTransform = z.transform((input, ctx) => {
        try {
            let num = Number(input);
            if (Number.isNaN(num) || !Number.isInteger(num) || num <= 0) {
                ctx.issues.push({
                    input,
                    code: `custom`,
                    message: `Invalid ID: must be a positive integer.`,
                });
                return z.NEVER;
            }
            return num;
        } catch (error) {
            ctx.issues.push({
                input,
                code: `custom`,
                message: `Invalid ID: must be a number.`,
            });
            return z.NEVER;
        }
    });
    public static zUserID = z.string().min(1).max(64).regex(/^\d+$|^me$/, {
        error: `ID must be a non-empty string of digits or the word "me".`,
    });
    public static zAssetFileFormat = z.enum(AssetFileFormat);
    public static zAssetStatus = z.enum(Status);
    public static zNumberIDObj = z.object({
        id: Validator.zNumberIDTransform,
    });

    public static zCreateAssetv3 = Asset.validator.pick({
        type: true,
        name: true,
        description: true,
        license: true,
        licenseUrl: true,
        sourceUrl: true,
        tags: true,
    });

    public static zFilterAssetv3 = z.object({
        type: Validator.zAssetFileFormat.optional(),
        status: Validator.zAssetStatus.optional(),
        tags: z.array(z.enum(Tags)).optional(),
        page: z.coerce.number().int().min(1).optional(),
        limit: z.coerce.number().int().min(1).max(250).optional(),
        minimalData: this.zBool.default(false),
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

    public static zAssetIdArray = z.array(Validator.zNumberIDTransform);


    public static validateThumbnail(file: File) {
        let isAcceptableImage =
            ((file.type === `image/png` && file.name.endsWith(`.png`)) ||
                (file.type === `image/jpeg` && file.name.endsWith(`.jpg`)) ||
                (file.type === `image/gif` && file.name.endsWith(`.gif`)) ||
                (file.type === `image/webp` && file.name.endsWith(`.webp`)));

        return isAcceptableImage
    }

    public static validateAssetFile(file: File, type: AssetFileFormat): boolean {
        let typeFileExtension = type.split(`_`)[1].toLowerCase();
        switch (type) {
            // PC assets
            case AssetFileFormat.Saber_Saber:
            case AssetFileFormat.Avatar_Avatar:
            case AssetFileFormat.Platform_Plat:
            case AssetFileFormat.Note_Bloq:
            case AssetFileFormat.Wall_Pixie:
            case AssetFileFormat.HealthBar_Energy:
                return file.type === `application/octet-stream` && file.name.endsWith(`.${typeFileExtension}`);
            // Quest/PC assets
            case AssetFileFormat.Saber_Wacker:
            case AssetFileFormat.Note_Cyoob:
            case AssetFileFormat.Wall_Box:
                return (file.type === `application/zip` || file.type === `application/x-zip-compressed`) && file.name.endsWith(`.${typeFileExtension}`);
            // Sound assets
            case AssetFileFormat.Sound_Ogg:
                return file.type === `audio/ogg` && file.name.endsWith(`.${typeFileExtension}`);
            case AssetFileFormat.Sound_Mp3:
                return file.type === `audio/mpeg` && file.name.endsWith(`.${typeFileExtension}`);
            // Banner assets
            case AssetFileFormat.Banner_Png:
                return file.type === `image/png` && file.name.endsWith(`.${typeFileExtension}`);
            // JSON assets
            case AssetFileFormat.ChromaEnv_JSON:
            case AssetFileFormat.CountersPlusConfig_JSON:
            case AssetFileFormat.HSVConfig_JSON:
            case AssetFileFormat.Camera2Config_JSON:
                return file.type === `application/json` && file.name.endsWith(`.${typeFileExtension}`);
            default:
                return false; // Invalid asset type
        }
    }

    public static async validateAssetFileData(file: File, type: AssetFileFormat): Promise<{ valid: boolean; reason?: string; }> {
        switch (type) {
            // Unity asset format files
            case AssetFileFormat.Saber_Saber:
            case AssetFileFormat.Avatar_Avatar:
            case AssetFileFormat.Platform_Plat:
            case AssetFileFormat.Note_Bloq:
            case AssetFileFormat.Wall_Pixie:
            case AssetFileFormat.HealthBar_Energy:
                // check that the first 6 bytes match the Unity asset bundle file signature "UnityFS"
                if (file.size > 6 && new Uint8Array(await file.slice(0, 6).arrayBuffer()).every((byte, index) => byte === "UnityFS".charCodeAt(index))) {
                    return { valid: true };
                } else {
                    return { valid: false, reason: "Invalid Unity asset bundle file." };
                }
            // Zip files
            case AssetFileFormat.Saber_Wacker:
            case AssetFileFormat.Note_Cyoob:
            case AssetFileFormat.Wall_Box:
                // open the file as a zip and check the manifest file exists
                try {
                    const zip = await jszip.loadAsync(await file.arrayBuffer());
                    let manifest = zip.file("package.json");
                    if (!manifest) {
                        return { valid: false, reason: `Missing package.json`}; // package.json not found in zip folder
                    }
                    let result = await manifest.async("string").then((data) => {
                        let parsedData = z.object({
                            androidFileName: z.string(),
                            pcFileName: z.string(),
                            descriptor: z.object({
                                objectName: z.string(),
                                author: z.string(),
                                description: z.string(),
                                coverImage: z.string()
                            }),
                        }).safeParse(JSON.parse(data));
                        if (!parsedData.success) {
                            return parseErrorMessage(parsedData.error); // manifest.json invalid
                        } else {
                            return true; // manifest.json valid
                        }
                    });
                    if (result === true) {
                        return { valid: false, reason: `${result}` }; // manifest.json invalid
                    }
                } catch {
                    return { valid: false, reason: "Invalid file." };
                }
            case AssetFileFormat.Sound_Ogg:
            case AssetFileFormat.Sound_Mp3:
            case AssetFileFormat.Banner_Png:
            case AssetFileFormat.ChromaEnv_JSON:
            case AssetFileFormat.CountersPlusConfig_JSON:
            case AssetFileFormat.HSVConfig_JSON:
            case AssetFileFormat.Camera2Config_JSON:
                return { valid: true }; // No additional validation for these types
            default:
                return { valid: false, reason: `File format not supported.` }; // No additional validation for other types

        }
    }
}
