import { Logger, LogLevel } from "../../../../shared/Logger.ts";
import { Validator } from "../../../../shared/Validator.ts";
import { getHashFromFile, parseErrorMessage } from "../../../../shared/Tools.ts";
import { Asset, assetApiV3Schema, ContentHash, Game, GameVersion, Project, projectApiV3Schema, Status, UserPermissions, Version, versionApiV3Schema } from "../../../../shared/Database.ts";
import path from "node:path";
import fs from "node:fs";
import { EnvConfig } from "../../../../shared/EnvConfig.ts";
import { loggedInProcedure, router } from "../../../trpc.ts";
import { zfd } from "zod-form-data";
import { createHash } from "node:crypto";
import { TRPCError } from "@trpc/server";
import JSZip from "jszip";
import { getManifestFromString, Manifest } from "../../../../shared/ModParser.ts";
import z from "zod";
import { Op } from "sequelize";
import { PathsObject } from "openapi3-ts/oas31";

/*
== Assets ==
Files follow this structure:
/storage/{uploads}/{assetId}/{files...}

Where
- {uploads} is the uploads directory as per EnvConfig
- {assetId} is the ID of the asset in the database
- {files...} are the files associated with the asset, including:
    - The main asset file, named as per ${asset.fileSafeName}.${asset.type} (e.g., myModel.whacker)
    - Icon files, named as 1.png, 2.jpg, etc.

== Mods ==
Files follow this structure:
/storage/{uploads}/{projectId}/{versionId}/{files...}

Where
- {uploads} is the uploads directory as per EnvConfig
- {projectId} is the ID of the project in the database
  - Icon will go here
- {versionId} is the ID of the version in the database
- {files...} are the files associated with the version, including:
    - The main mod zip file, named as per ${version.zipFileName} 
*/

export const uploadStuff = router({
    assetUpload: loggedInProcedure()
    //.meta({ openapi: { method: 'POST', path: '/v3/asset/upload', tags: ['Upload'], enabled: false } })
    .input(zfd.formData({
        data: zfd.json(Asset.validator.pick({
            type: true,
            name: true,
            renderingMethod: true,
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
            renderingMethod: input.data.renderingMethod,
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
                throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR', message: `Failed to save asset file. Please contact a site administrator.` });
            });

            for (let [iconName, iconFile] of imageNames) {
                Logger.debug(`Saving icon file ${iconName} for asset ID ${asset.id}`);
                await iconFile.arrayBuffer().then(async (buffer) => {
                    fs.writeFileSync(path.join(asset.folderPath, iconName), Buffer.from(buffer));
                }).catch((err) => {
                    Logger.error(`Error saving icon file: ${err.message}`)
                    fs.unlinkSync(path.join(EnvConfig.storage.uploads, asset.assetFileName));
                    throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR', message: `Failed to save icon file. Please contact a site administrator.` });
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
    .input(zfd.formData({
        data: zfd.json(Project.validator.pick({
            name: true,
            nameId: true,
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
            nameId: input.data.nameId,
            description: input.data.description,
            category: input.data.category,
            gameName: input.data.gameName,
            gitUrl: input.data.gitUrl,
            summary: input.data.summary,
            iconFileName: iconName,
            collaboratorIds: [],
            lastUpdatedById: ctx.user.id,
            status: Status.Private,
        }).then(async (project) => {
            project.$add(`authors`, ctx.user);
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
    //.meta({ openapi: { method: 'POST', path: '/v3/project/{id}/upload', tags: ['Upload'], enabled: false } })
    .input(zfd.formData({
        id: zfd.text(),
        data: zfd.json(Version.validator.pick({
            platform: true,
            semver: true,
            dependencies: true,
        }).extend({
            supportedGameVersionIds: z.array(z.number()).nonempty(),
        })),
        modZip: zfd.file(), // main asset file, will be validated later based on type,
        immidateSubmit: zfd.checkbox().optional(), // if true, will immidately submit the version for review after upload instead of saving as private
    }))
    .output(versionApiV3Schema)
    .mutation(async ({ ctx, input }) => {
        const project = await Project.findByPk(input.id);
        if (!project) {
            throw new TRPCError({ code: 'NOT_FOUND', message: 'Project not found' });
        }
        if (!ctx.user.checkRoles([UserPermissions.Mods_Create], project.gameName)) {
            throw new TRPCError({ code: 'FORBIDDEN', message: 'You do not have permission to upload versions.' });
        }

        if (!project.canUploadVersion(ctx.user)) {
            throw new TRPCError({ code: 'FORBIDDEN', message: 'You do not have permission to upload versions for this project.' });
        }

        let newGameVersions = GameVersion.findAll({
            where: {
                [Op.or]: [
                    { id: input.data.supportedGameVersionIds },
                    { linkedVersionIds: { [Op.overlap]: input.data.supportedGameVersionIds } } // also include game versions that have linkedVersionIds that overlap with the provided supportedGameVersionIds,
                ]
            }
        }).then((gameVersions) => {
            if (gameVersions.length >= input.data.supportedGameVersionIds.length) {
                throw new TRPCError({ code: 'BAD_REQUEST', message: 'One or more supported game versions not found' });
            }
            return gameVersions;
        }).catch((err) => {
            Logger.error(`Error validating supported game versions: ${parseErrorMessage(err)}`);
            throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR', message: 'Failed to validate supported game versions. Please contact a site administrator.' });
        });

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
        let manifestJson: Manifest | null = null;
        for (let filePath in zip.files) {
            let file = zip.files[filePath];
            if (file.dir) continue; // skip directories
            
            let data = await file.async("nodebuffer").catch((err) => {
                Logger.error(`Error reading file ${filePath} from zip archive: ${err.message}`);
                throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR', message: 'Failed to process zip archive. Please contact a site administrator.' });
            });
            const md5Hash = createHash('md5').update(data).digest('hex');
            hashes.push({
                path: filePath,
                hash: md5Hash,
            });

            if (path.basename(filePath).toLowerCase() === "manifest.json") {
                manifestJson = getManifestFromString(data.toString());
            } else if (!manifestJson && path.extname(filePath).toLowerCase() === ".dll") {
                manifestJson = getManifestFromString(data.toString());
            }
        }

        if (!manifestJson) {
            Logger.warn(`No manifest found in uploaded zip file for project ID ${project.id}. Version will be created without manifest data.`);
        } else {
            if (manifestJson.id !== project.nameId) {
                throw new TRPCError({ code: 'BAD_REQUEST', message: 'Manifest mod ID does not match project nameId.' });
            }
        }

        await newGameVersions; // trigger errors before we create the version entry or save the file ideally

        return await Version.create({
            projectId: project.id,
            platform: input.data.platform,
            semver: input.data.semver,
            dependencies: input.data.dependencies,
            zipHash: fileHash,
            fileSize: input.modZip.size,
            uploaderId: ctx.user.id,
            lastUpdatedById: ctx.user.id,
            status: Status.Private,
            contentHashes: [], // will be filled in later by a background job after the file is saved and processed
        }).then(async (version) => {
            version.$set(`supportedGameVersions`, await newGameVersions);
            Logger.log(`Version database entry created for user ${ctx.user?.id} with version ID ${version.id} for project ID ${project.id}`);
            let versionFolder = path.join(project.folderPath, version.id.toString());
            fs.mkdirSync(versionFolder, { recursive: true });
            await input.modZip.arrayBuffer().then(async (buffer) => {
                fs.writeFileSync(path.join(versionFolder, await version.zipFileName), Buffer.from(buffer));
                if (manifestJson) {
                    fs.writeFileSync(path.join(versionFolder, await version.manifestName), JSON.stringify(manifestJson));
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

export const OpenAPIUploadDocs: PathsObject = {
    "/v3/asset/upload": {
        post: {
            tags: ["Assets"],
            summary: "Upload a new asset",
            requestBody: {
                content: {
                    "multipart/form-data": {
                        schema: {
                            type: "object",
                            properties: {
                                data: {
                                    type: "string",
                                    format: "json",
                                    description: "JSON string containing the asset data, including type, name, description, license, licenseUrl (if applicable), sourceUrl, and tags. See the Asset shcema for more details."
                                },
                                immidateSubmit: {
                                    type: "boolean",
                                },
                                asset: {
                                    type: "string",
                                    format: "binary",
                                },
                                icon_1: {
                                    type: "string",
                                    format: "binary",
                                },
                                icon_2: {
                                    type: "string",
                                    format: "binary",
                                },
                                icon_3: {
                                    type: "string",
                                    format: "binary",
                                },
                                icon_4: {
                                    type: "string",
                                    format: "binary",
                                },
                                icon_5: {
                                    type: "string",
                                    format: "binary",
                                },
                            },
                            required: ["data", "asset", "icon_1"],
                        }
                    }
                }
            },
            responses: {
                200: {
                    description: "Asset uploaded successfully",
                    content: {
                        "application/json": {
                            schema: assetApiV3Schema,
                        }
                    }
                },
                400: {
                    description: "Bad request, invalid input data",
                },
                401: {
                    description: "Unauthorized, user not logged in",
                },
                403: {
                    description: "Forbidden, user does not have permission to upload assets",
                },
                500: {
                    description: "Internal server error",
                }
            }
         }
    },
    "/v3/project/{id}/upload": {
        post: {
            tags: ["Mods"],
            summary: "Upload a new version for a project",
            requestBody: {
                content: {
                    "multipart/form-data": {
                        schema: {
                            type: "object",
                            properties: {
                                id: {
                                    type: "string",
                                },
                                data: {
                                    type: "string",
                                    format: "json",
                                    description: "JSON string containing the version data, including platform, semver, dependencies, and supportedGameVersionIds. See the Version shcema for more details."
                                },
                                modZip: {
                                    type: "string",
                                    format: "binary",
                                },
                                immidateSubmit: {
                                    type: "boolean",
                                },
                            },
                            required: ["id", "data", "modZip"],
                        }
                    }
                }
            },
            responses: {
                200: {
                    description: "Version uploaded successfully",
                    content: {
                        "application/json": {
                            schema: versionApiV3Schema,
                        }
                    }
                },
                400: {
                    description: "Bad request, invalid input data",
                },
                401: {
                    description: "Unauthorized, user not logged in",
                },
                403: {
                    description: "Forbidden, user does not have permission to upload versions for this project",
                },
                404: {
                    description: "Project not found",
                },
                500: {
                    description: "Internal server error",
                }
            }
        }
    }
}