import { Router, RequestHandler, NextFunction } from "express";
import { Logger, LogLevel } from "../../../../shared/Logger.ts";
import { Validator } from "../../../../shared/Validator.ts";
import { parseErrorMessage } from "../../../../shared/Tools.ts";
import { Asset, assetApiV3Schema, ContentHash, Game, Project, projectApiV3Schema, Status, UserPermissions, Version, versionApiV3Schema } from "../../../../shared/Database.ts";
import path from "node:path";
import fs from "node:fs";
import { EnvConfig } from "../../../../shared/EnvConfig.ts";
import { loggedInProcedure, router } from "../../../trpc.ts";
import { zfd } from "zod-form-data";
import { createHash } from "node:crypto";
import { TRPCError } from "@trpc/server";
import JSZip from "jszip";
import { getManifestFromString } from "../../../../shared/ModParser.ts";

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

export const uploadStuff = router({
    assetUpload: loggedInProcedure()
//    .meta({ openapi: { method: 'POST', path: '/v3/asset/upload', tags: ['Upload'] } })
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
        immidateSubmit: zfd.checkbox().optional(), // if true, will immidately submit the asset for review after upload instead of saving as private 
        asset: zfd.file(), // main asset file, will be validated later based on type
        icon_1: zfd.file().refine((file) => Validator.validateThumbnail(file), { message: "Invalid icon file format" }),
        icon_2: zfd.file().refine((file) => Validator.validateThumbnail(file), { message: "Invalid icon file format" }).optional(),
        icon_3: zfd.file().refine((file) => Validator.validateThumbnail(file), { message: "Invalid icon file format" }).optional(),
        icon_4: zfd.file().refine((file) => Validator.validateThumbnail(file), { message: "Invalid icon file format" }).optional(),
        icon_5: zfd.file().refine((file) => Validator.validateThumbnail(file), { message: "Invalid icon file format" }).optional(),
    }).refine((data) => {
        return Validator.validateAssetFile(data.asset, data.data.type);
    }, { message: "Invalid asset file format for the specified type" }))
//    .output(assetApiV3Schema)
    .mutation(async ({ ctx, input }) => {
        let defaultGame = await Game.defaultGame;
        if (!defaultGame) {
            throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR', message: 'Default game not found. Please contact a site administrator.' });
        }
        if (!(await ctx.user.checkRoles([UserPermissions.Asset_Create], defaultGame.name))) {
            throw new TRPCError({ code: 'FORBIDDEN', message: 'You do not have permission to upload assets.' });
        }
        Logger.debug(`Asset upload started for user with asset type ${input.data.type}`);
        let fileHash = await getHashFromFile(input.asset);
        let imageNames: Map<string, File> = new Map();
        for (let i = 1; i <=5; i++) {
            let iconFile = (input as any)[`icon_${i}`] as File | undefined;
            if (iconFile) {
                imageNames.set(`${i}${path.extname(iconFile.name)}`, iconFile);
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
            gameName: defaultGame.name,
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
            if (input.immidateSubmit) {
                await asset.setStatus(Status.Pending, ctx.user, "Asset immidately submitted for review by uploader").catch((err) => {
                    Logger.error(`Error setting asset status to pending: ${parseErrorMessage(err)}`);
                    throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR', message: 'Failed to submit asset for review. Please contact a site administrator.' });
                });
            }
            return await asset.toApiV3();
        }).catch((err) => {
            Logger.debug(`Error creating asset: ${parseErrorMessage(err)}`);
            throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR', message: parseErrorMessage(err) });
        });
    }),
    projectCreate: loggedInProcedure()
    //.meta({ openapi: { method: 'POST', path: '/v3/project/create', tags: ['Upload'] } })
    .input(zfd.formData({
        data: zfd.json(Project.validator.pick({
            name: true,
            description: true,
            category: true,
            gameName: true,
            gitUrl: true,
            summary: true,
        })),
        icon_1: zfd.file().refine((file) => Validator.validateThumbnail(file), { message: "Invalid icon file format" }),
    }))
    .output(projectApiV3Schema)
    .mutation(async ({ ctx, input }) => {
        let game = await Game.findByPk(input.data.gameName);
        if (!game) {
            throw new TRPCError({ code: 'BAD_REQUEST', message: 'Invalid game specified' });
        }
        if (!ctx.user.checkRoles([UserPermissions.Mods_Create], game.name)) {
            throw new TRPCError({ code: 'FORBIDDEN', message: 'You do not have permission to create projects for this game.' });
        }
        let iconFile = input.icon_1;
        let iconName = `${await getHashFromFile(iconFile)}${path.extname(iconFile.name)}`;
        
        return await Project.create({
            name: input.data.name,
            description: input.data.description,
            category: input.data.category,
            gameName: input.data.gameName,
            gitUrl: input.data.gitUrl,
            summary: input.data.summary,
            iconFileName: iconName,
            authorIds: [ctx.user.id],
            collaboratorIds: [],
            lastUpdatedById: ctx.user.id,
            status: Status.Private,
        }).then(async (project) => {
            Logger.log(`Project database entry created for user ${ctx.user?.id} with project ID ${project.id}`);
            fs.mkdirSync(project.folderPath, { recursive: true });
            await iconFile.arrayBuffer().then(async (buffer) => {
                fs.writeFileSync(path.join(project.folderPath, iconName), Buffer.from(buffer));
            }).catch((err) => {
                Logger.error(`Error saving project icon file: ${err.message}`)
                throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR', message: 'Failed to save project icon file. Please contact a site administrator.' });
            });
            return await project.toApiV3();
        }).catch((err) => {
            Logger.error(`Error creating project: ${parseErrorMessage(err)}`);
            throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR', message: 'Failed to create project. Please contact a site administrator.' });
        });
    }),
    versionUpload: loggedInProcedure()
    //.meta({ openapi: { method: 'POST', path: '/v3/project/{id}/upload', tags: ['Upload'] } })
    .input(zfd.formData({
        id: zfd.text(),
        data: zfd.json(Version.validator.pick({
            platform: true,
            semver: true,
            dependencies: true,
            supportedGameVersionIds: true,
        })),
        modZip: zfd.file(), // main asset file, will be validated later based on type,
        immidateSubmit: zfd.checkbox().optional(), // if true, will immidately submit the version for review after upload instead of saving as private
    }))
    .output(versionApiV3Schema)
    .mutation(async ({ ctx, input }) => {
        let project = await Project.findByPk(input.id);
        if (!project) {
            throw new TRPCError({ code: 'NOT_FOUND', message: 'Project not found' });
        }
        if (!ctx.user.checkRoles([UserPermissions.Mods_Create], project.gameName)) {
            throw new TRPCError({ code: 'FORBIDDEN', message: 'You do not have permission to upload versions.' });
        }

        if (!project.canUploadVersion(ctx.user)) {
            throw new TRPCError({ code: 'FORBIDDEN', message: 'You do not have permission to upload versions for this project.' });
        }

        let fileHash = await getHashFromFile(input.modZip);
        if ((input.modZip.type !== "application/zip" && input.modZip.type !== "application/x-zip-compressed") || path.extname(input.modZip.name) !== ".zip") {
            throw new TRPCError({ code: 'BAD_REQUEST', message: 'Uploaded file is not a valid zip archive.' });
        }
        let zip = await JSZip.loadAsync(await input.modZip.arrayBuffer()).catch((err) => {
            Logger.error(`Error reading uploaded zip file: ${err.message}`);
            throw new TRPCError({ code: 'BAD_REQUEST', message: 'Uploaded file is not a valid zip archive.' });
        });
        if (!zip) {
            throw new TRPCError({ code: 'BAD_REQUEST', message: 'Uploaded file is not a valid zip archive.' });
        }

        let hashes: ContentHash[] = [];
        let manifestJson: any = null;
        zip.forEach(async (relativePath, file) => {
            if (file.dir) return;
            
            let data = await file.async("nodebuffer").catch((err) => {
                Logger.error(`Error reading file ${relativePath} from zip archive: ${err.message}`);
                throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR', message: 'Failed to process zip archive. Please contact a site administrator.' });
            });
            const md5Hash = createHash('md5').update(data).digest('hex');
            hashes.push({
                path: relativePath,
                hash: md5Hash,
            });

            manifestJson = getManifestFromString(data.toString());
        });


        return await Version.create({
            projectId: project.id,
            platform: input.data.platform,
            semver: input.data.semver,
            dependencies: input.data.dependencies,
            supportedGameVersionIds: input.data.supportedGameVersionIds,
            zipHash: fileHash,
            fileSize: input.modZip.size,
            uploaderId: ctx.user.id,
            lastUpdatedById: ctx.user.id,
            status: Status.Private,
            contentHashes: [], // will be filled in later by a background job after the file is saved and processed
        }).then(async (version) => {
            Logger.log(`Version database entry created for user ${ctx.user?.id} with version ID ${version.id} for project ID ${project.id}`);
            let versionFolder = path.join(project.folderPath, version.id.toString());
            fs.mkdirSync(versionFolder, { recursive: true });
            await input.modZip.arrayBuffer().then(async (buffer) => {
                fs.writeFileSync(path.join(versionFolder, await version.fileName), Buffer.from(buffer));
                if (manifestJson) {
                    fs.writeFileSync(path.join(versionFolder, await version.manifestName), manifestJson);
                }
            }).catch((err) => {
                Logger.error(`Error saving version mod file: ${err.message}`)
                throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR', message: 'Failed to save version mod file. Please contact a site administrator.' });
            });
            if (input.immidateSubmit) {
                await version.setStatus(Status.Pending, ctx.user, "Version immidately submitted for review by uploader").catch((err) => {
                    Logger.error(`Error setting version status to pending: ${parseErrorMessage(err)}`);
                    throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR', message: 'Failed to submit version for review. Please contact a site administrator.' });
                });
            }
            return await version.toApiV3();
        }).catch((err) => {
            Logger.error(`Error creating version: ${parseErrorMessage(err)}`);
            throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR', message: 'Failed to create version. Please contact a site administrator.' });
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
