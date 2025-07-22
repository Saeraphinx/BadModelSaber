import express, { Router } from "express";
import { EnvConfig } from "../../../shared/EnvConfig.ts";
import { AssetFileFormat } from "../../../shared/Database.ts";

export class FileRoutes {
    public static loadRoutes(router: Router): void {
        router.use(`/icons`, express.static(EnvConfig.storage.icons, {
            dotfiles: `ignore`,
            index: false,
            extensions: [`png`, `jpg`, `gif`, `webp`],
            lastModified: true,
            immutable: true,
            maxAge: EnvConfig.isProduction ? `2 weeks` : 0, // 2 weeks in production, no caching in development
            fallthrough: false, // Do not fall through to next middleware if file not found
        }));

        let fileExtentions = Object.values(AssetFileFormat).map(format => format.split(`_`)[1]);

        router.use(`/uploads`, express.static(EnvConfig.storage.uploads, {
            dotfiles: `ignore`,
            index: false,
            extensions: fileExtentions,
            lastModified: true,
            immutable: true,
            maxAge: EnvConfig.isProduction ? `2 weeks` : 0, // 2 weeks in production, no caching in development
            fallthrough: false, // Do not fall through to next middleware if file not found
        }));
    }
}