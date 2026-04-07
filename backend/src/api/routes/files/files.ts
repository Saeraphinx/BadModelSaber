import express, { Router } from "express";
import { EnvConfig } from "../../../shared/EnvConfig.ts";
import { Asset, AssetFileFormat } from "../../../shared/Database.ts";
import path from "path";
import fs from "fs";
import { Logger } from "../../../shared/Logger.ts";

export class FileRoutes {
    public static loadRoutes(router: Router): void {

        router.use(`/`, express.static(EnvConfig.storage.uploads, {
            dotfiles: 'deny',
            cacheControl: true,
            maxAge: '14d',
            immutable: true,
        }));

        /*router.get(`/:assetId/:fileName`, async (req, res) => {
            const assetId = req.params.assetId;
            const fileName = req.params.fileName;

            let requestedPath = path.resolve(EnvConfig.storage.uploads, assetId, fileName);
             if (!requestedPath.startsWith(path.resolve(EnvConfig.storage.uploads))) {
                Logger.warn(`Invalid file path attempt ${req.path} resulting in ${requestedPath}`);
                res.status(400).json({ message: `Invalid file path` });
                return;
            } 
            
            if (!fs.existsSync(requestedPath)) {
                res.status(404).json({ message: `File not found` });
                return;
            }

            Logger.debug(`Serving file via new route: ${requestedPath}`);
            res.sendFile(requestedPath, { 
                dotfiles: 'deny', 
                cacheControl: true,
                maxAge: '14d',
                immutable: true
            });
        });

        // compatibility route for old asset file paths
        router.get(`/:type/:assetId/:fileName`, async (req, res) => {
            const type = req.params.type;
            let assetId = req.params.assetId;
            let fileName = req.params.fileName;

            let requestedPath = path.resolve(EnvConfig.storage.uploads, assetId, fileName);
            if (!requestedPath.startsWith(path.resolve(EnvConfig.storage.uploads))) {
                Logger.warn(`Invalid file path attempt ${req.path} resulting in ${requestedPath}`);
                res.status(400).json({ message: `Invalid file path` });
                return;
            } 

            if (!fs.existsSync(requestedPath)) {
                await Asset.findOne({ where: { id: assetId } }).then(asset => {
                    if (!asset) {
                        res.status(404).json({ message: `File not found` });
                        return;
                    }
                    requestedPath = asset.assetFilePath;
                });
            }

            Logger.debug(`Serving file via compat route: ${requestedPath}`);
            res.sendFile(requestedPath, { 
                dotfiles: 'deny', 
                cacheControl: true,
                maxAge: '14d',
                immutable: true
            });
        });*/
    }
}