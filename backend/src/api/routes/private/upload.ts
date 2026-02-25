import { Router, RequestHandler, NextFunction } from "express";
import { Logger, LogLevel } from "../../../shared/Logger.ts";
import { Validator } from "../../../shared/Validator.ts";
import { parseErrorMessage } from "../../../shared/Tools.ts";
import { Asset, Status, UserPermissions } from "../../../shared/Database.ts";
import path from "node:path";
import fs from "node:fs";
import { EnvConfig } from "../../../shared/EnvConfig.ts";
import { authProcedure, router } from "../../trpc.ts";
import { zfd } from "zod-form-data";
import { createHash } from "node:crypto";

/*
Files follow this structure:
/storage/{uploads}/{assetId}/{files...}

Where
- {uploads} is the uploads directory as per EnvConfig
- {assetId} is the ID of the asset in the database
- {files...} are the files associated with the asset, including:
    - The main asset file, named as per ${asset.name}.${asset.type} (e.g., myModel.whacker)
    - Icon files, named as 1.png, 2.jpg, etc.
*/

export const uploadAssetV3 = router({
    assetUpload: authProcedure([UserPermissions.Create_Assets])
    .input(zfd.formData({
        data: zfd.json(Asset.validator.pick({
            type: true,
            name: true,
            description: true,
            license: true,
            licenseUrl: true,
            sourceUrl: true,
            tags: true,
        })),
        asset: zfd.file(), // main asset file, will be validated later based on type
        icon_1: zfd.file().refine((file) => Validator.validateThumbnail(file), { message: "Invalid icon file format" }),
        icon_2: zfd.file().refine((file) => Validator.validateThumbnail(file), { message: "Invalid icon file format" }).optional(),
        icon_3: zfd.file().refine((file) => Validator.validateThumbnail(file), { message: "Invalid icon file format" }).optional(),
        icon_4: zfd.file().refine((file) => Validator.validateThumbnail(file), { message: "Invalid icon file format" }).optional(),
        icon_5: zfd.file().refine((file) => Validator.validateThumbnail(file), { message: "Invalid icon file format" }).optional(),
    }).refine((data) => {
        return Validator.validateAssetFile(data.asset, data.data.type);
    }, { message: "Invalid asset file format for the specified type" }))
    .mutation(async ({ ctx, input }) => {
        Logger.debug(`Asset upload started for user with asset type ${input.data.type}`);
        let fileHash = await getHashFromFile(input.asset);
        let imageNames: Map<string, File> = new Map();
        for (let i = 1; i <=5; i++) {
            let iconFile = (input as any)[`icon_${i}`] as File | undefined;
            if (iconFile) {
                imageNames.set(`${i}.${path.extname(iconFile.name)}`, iconFile);
            }
        }
            
        return Asset.create({
            name: input.data.name,
            description: input.data.description,
            license: input.data.license,
            licenseUrl: input.data.licenseUrl,
            sourceUrl: input.data.sourceUrl,
            type: input.data.type,
            tags: input.data.tags,
            fileSafeName: Asset.convertNameToFileSafe(input.data.name),
            uploaderId: ctx.user.id,
            fileHash: fileHash,
            fileSize: input.asset.size,
            iconNames: Array.from(imageNames.keys()),
            status: Status.Private,
        }).then(async (asset) => {
            Logger.debug(`Asset database entry created for user ${ctx.user?.id} with asset ID ${asset.id}`);
            fs.mkdirSync(asset.folderPath, { recursive: true });
            await input.asset.arrayBuffer().then(async (buffer) => {
                fs.writeFileSync(asset.assetFilePath, Buffer.from(buffer));
            }).catch((err) => {
                Logger.error(`Error saving asset file: ${err.message}`)
                throw new Error(`Failed to save asset file. Please contact a site administrator.`);
            });

            for (let [iconName, iconFile] of imageNames) {
                Logger.debug(`Saving icon file ${iconName} for asset ID ${asset.id}`);
                await iconFile.arrayBuffer().then(async (buffer) => {
                    fs.writeFileSync(path.join(asset.folderPath, iconName), Buffer.from(buffer));
                }).catch((err) => {
                    Logger.error(`Error saving icon file: ${err.message}`)
                    fs.unlinkSync(path.join(EnvConfig.storage.uploads, asset.assetFileName));
                    throw new Error(`Failed to save icon file. Please contact a site administrator.`);
                });
            }
            Logger.debug(`Asset upload completed for user ${ctx.user?.id} with asset ID ${asset.id}`);
            return await asset.getApiV3Response();
        }).catch((err) => {
            Logger.debug(`Error creating asset: ${parseErrorMessage(err)}`);
            throw new Error(parseErrorMessage(err));
        });
    })
})

function getHashFromFile(file: File | { path: string }): Promise<string> {
    return new Promise(async (resolve, reject) => {
        const hash = createHash('md5');

        // If running with a server-side uploaded file that has a path, stream from fs
        if ('path' in file && typeof file.path === 'string') {
            const stream = fs.createReadStream(file.path);
            stream.on('data', (data) => hash.update(data));
            stream.on('end', () => resolve(hash.digest('hex')));
            stream.on('error', (err) => reject(err));
            return;
        }

        // Browser File / Blob: use arrayBuffer to compute hash
        try {
            if (typeof (file as File).arrayBuffer === 'function') {
                const buffer = Buffer.from(await (file as File).arrayBuffer());
                hash.update(buffer);
                resolve(hash.digest('hex'));
                return;
            }

            // Fallback: try to use a stream() method if available
            const possibleStream = (file as any).stream?.();
            if (possibleStream) {
                // If it's a Node Readable
                if (typeof possibleStream.on === 'function') {
                    possibleStream.on('data', (data: Buffer) => hash.update(data));
                    possibleStream.on('end', () => resolve(hash.digest('hex')));
                    possibleStream.on('error', (err: any) => reject(err));
                    return;
                }

                // If it's a web ReadableStream
                const reader = possibleStream.getReader();
                try {
                    while (true) {
                        const { done, value } = await reader.read();
                        if (done) break;
                        hash.update(Buffer.from(value));
                    }
                    resolve(hash.digest('hex'));
                    return;
                } catch (err) {
                    reject(err);
                    return;
                }
            }

            reject(new Error('Unsupported file object for hashing'));
        } catch (err) {
            reject(err);
        }
    });
}
