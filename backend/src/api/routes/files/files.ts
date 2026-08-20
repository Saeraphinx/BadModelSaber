import express, { Router } from "express";
import { EnvConfig } from "../../../shared/EnvConfig.ts";
import { Asset, AssetFileFormat, Project, Version } from "../../../shared/Database.ts";
import path from "path";
import fs from "fs";
import { Logger } from "../../../shared/Logger.ts";
import { z } from "zod/v4";

export class FileRoutes {
    public static loadRoutes(router: Router, legacyRouter: Router): void {
        // v2 compatibility routes for mod files and icons
        legacyRouter.get(`/mod/:hash`, async (req, res) => {
            const input = z.string().safeParse(req.params.hash);
            if (!input.success) {
                res.status(400).json({ message: `Invalid hash` });
                return;
            }
            let hash = input.data;
            hash = hash.replace(`.zip`, ``);
            let version = await Version.findOne({ where: { zipHash: hash }, include: [Project] });
            if (!version) {
                res.status(404).json({ message: `Mod not found` });
                return;
            }
            res.redirect(302, version.downloadUrl)
            /*if (!version) {
                res.status(404).json({ message: `Mod not found` });
                return;
            }
            let filePath = version.zipFilePath;
            if (!fs.existsSync(filePath)) {
                res.status(404).json({ message: `File not found` });
                return;
            }
            Logger.debug(`Serving mod file via legacy route: ${filePath}`);
            res.sendFile(filePath, {
                dotfiles: 'deny',
                cacheControl: true,
                maxAge: '14d',
                immutable: true
            });
            */
        });

        legacyRouter.get(`/icon/:hash`, async (req, res) => {
            res.sendFile(path.resolve(EnvConfig.uploadsPath, `default_beatsaber.png`), {
                dotfiles: 'deny',
                cacheControl: true,
                maxAge: '14d',
                immutable: true
            });
        })

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