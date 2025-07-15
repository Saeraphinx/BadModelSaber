import { Router, RequestHandler, NextFunction } from "express";
import fileUpload from "express-fileupload";
import { auth, MiddlewareFunction, validate } from "../../../RequestUtils.ts";
import { Logger, LogLevel } from "../../../../shared/Logger.ts";
import { Validator, z } from "../../../../shared/Validator.ts";
import { parseErrorMessage } from "../../../../shared/Tools.ts";
import { Asset, Status } from "../../../../shared/Database.ts";
import path from "node:path";
import { EnvConfig } from "../../../../shared/EnvConfig.ts";

export class UploadRoutesV3 {
    public static loadRoutes(router: Router): void {
        router.post(`/assets/upload`, auth(`loggedIn`, false), file(), (req, res) => {
            const files = req.files;
            const { responded, data: body } = validate(req, res, `multipart`, Validator.zCreateAssetv3);
            if (responded || req.auth.isAuthed === false) {
                return;
            }
            if (!files || !Array.isArray(files.uploadedFiles) || files.uploadedFiles.length === 0) {
                res.status(400).json({ error: "No files uploaded" });
                return;
            }

            if (files.uploadedFiles.length !== 2 || !files.asset || !files.icon_1) {
                res.status(400).json({ message: `Must have icon and asset file.` });
                return;
            }

            let fileAsset = files.asset as fileUpload.UploadedFile;
            if (fileAsset) {
                if (!Validator.validateAssetFile(fileAsset, body.fileFormat)) {
                    res.status(400).json({ message: "Invalid file format for asset" });
                    return;
                }
            } else {
                res.status(400).json({ message: "Asset file is required" });
                return;
            }

            let fileIconParamNames = [`icon_1`, `icon_2`, `icon_3`, `icon_4`, `icon_5`];
            let fileIcons: fileUpload.UploadedFile[] = [];
            for (let iconParamName of fileIconParamNames) {
                let fileIcon = files[iconParamName] as fileUpload.UploadedFile | undefined;
                if (fileIcon) {
                    let isAcceptableIcon = Validator.validateThumbnail(fileIcon);
                    if (!isAcceptableIcon) {
                        res.status(400).json({ message: `Invalid file format for ${iconParamName}` });
                        return;
                    } else {
                        fileIcons.push(fileIcon);
                    }
                }
            }

            if (fileIcons.length === 0) {
                res.status(400).json({ message: `At least one icon is required.` });
                return;
            }

            let iconNames = fileIcons.map(icon => {
                let extName = path.extname(icon.name);
                if (extName.length > 0) {
                    return null;
                }
                return `${icon.md5}${extName}`;
            });

            if (iconNames.includes(null)) {
                res.status(400).json({ error: `One or more icons have no extension.` });
                return;
            }

            Asset.create({
                name: body.name,
                description: body.description,
                license: body.license,
                licenseUrl: body.licenseUrl,
                sourceUrl: body.sourceUrl,
                fileFormat: body.fileFormat,
                type: body.type,
                tags: body.tags,
                uploaderId: req.auth.user.id,
                fileHash: fileAsset.md5,
                fileSize: fileAsset.size,
                iconNames: iconNames as string[],
                status: Status.Private,
            }).then((asset) => {
                fileAsset.mv(path.join(EnvConfig.storage.uploads, asset.fileName), (err) => {
                    if (err) {
                        Logger.error(`Error moving asset file: ${err.message}`);
                        res.status(500).json({ message: `Failed to save asset file. Please contact a site administrator.` });
                        asset.destroy();
                        return;
                    }
                });

                for (let fileIcon of fileIcons) {
                    let extName = path.extname(fileIcon.name);
                    if (extName.length > 0) {
                        return null;
                    }
                    fileIcon.mv(path.join(EnvConfig.storage.icons, `${fileIcon.md5}${extName}`), (err) => {
                        if (err) {
                            Logger.error(`Error moving icon file: ${err.message}`);
                            res.status(500).json({ error: `Failed to save icon file. Please contact a site administrator.` });
                            asset.destroy();
                            return;
                        }
                    });
                }

                res.status(201).json({
                    message: `Asset created successfully`,
                    asset: asset.getApiV3Response(),
                });
                return;
            }).catch((err) => {
                Logger.debug(`Error creating asset: ${parseErrorMessage(err)}`);
                res.status(500).json({ message: parseErrorMessage(err) });
                return;
            });
        });
    }      
}


function file(limit = 250 * 1024 * 1024): MiddlewareFunction {
    return fileUpload({
        limits: {
            files: 6,
            fileSize: limit,
            fields: 1
        },
        preserveExtension: true,
        abortOnLimit: true,
        limitHandler: (req, res, next) => {
            res.status(413).json({ error: "File size limit exceeded" });
        },
        hashAlgorithm: `sha256`,
    });
}