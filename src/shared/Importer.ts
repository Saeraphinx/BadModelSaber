import { Asset, AssetFileFormat, AssetPublicAPIv2, License, Status } from "./Database.ts";
import { Logger } from "./Logger.ts";
import * as fs from "fs";
import * as crypto from "crypto";
import sharp from "sharp";
import ffmpegPath from "ffmpeg-static";
import ffmpeg from "ffmpeg";
import path from "path";
import { EnvConfig } from "./EnvConfig.ts";
import { json, Op } from "sequelize";
import { parseErrorMessage } from "./Tools.ts";

type modelsaberasset= {
    [key: string]: AssetPublicAPIv2;
}

const hashType = `md5`;
const conversionStorage = `./storage/converts`;

export async function importFromOldModelSaber(): Promise<void> {
    try {
        Logger.log(`Importing data from old ModelSaber...`);
        const modelSaberAll = await fetch(`https://modelsaber.com/api/v2/get.php`).then(res => res.json() as Promise<modelsaberasset>).catch(err => {
            Logger.error(`Failed to fetch old ModelSaber data: ${err}`)
            throw err;
        });
        Logger.log(`Fetched ${Object.keys(modelSaberAll).length} assets from old ModelSaber.`);
        if (!fs.existsSync(conversionStorage)) {
            fs.mkdirSync(conversionStorage);
        }
        const thumbnailOutputDir = path.resolve(EnvConfig.storage.icons)
        let i = 0;
        for (const [key, asset] of Object.entries(modelSaberAll)) {
            if (i++ % 50 === 0) {
                Logger.log(`Processing asset ${i}/${Object.keys(modelSaberAll).length} (${key})`);
            }
            // check if asset already exists
            const existingAsset = await Asset.findOne({ where: { 
                [Op.or]: {
                    oldId: asset.id,
                    fileHash: asset.hash,
                }
            } });
            if (fs.existsSync(path.join(EnvConfig.storage.uploads, `${asset.hash}.${asset.type}`))) {
                continue;
            }
            if (existingAsset) {
                Logger.log(`Asset ${asset.id} (${asset.name}) already exists, skipping...`);
                continue;
            }
            let newType: AssetFileFormat;
            switch (asset.type) {
                case `saber`:
                    newType = AssetFileFormat.Saber_Saber;
                    break;
                case `platform`:
                    newType = AssetFileFormat.Platform_Plat;
                    break;
                case `avatar`:
                    newType = AssetFileFormat.Avatar_Avatar;
                    break;
                case `bloq`:
                    newType = AssetFileFormat.Note_Bloq;
                    break;
                default:
                    Logger.warn(`Unknown asset type ${asset.type} for asset ${asset.id}, skipping...`);
                    continue;
            }
            // #region download asset
            let assetHash = "";
            let assetSize = 0;
            await fetch(encodeURI(asset.download)).then(res => {
                if (!res.ok) {
                    throw new Error(`Failed to download asset ${asset.id} (${asset.name}): ${res.statusText}`);
                }
                return res.arrayBuffer()
            }).then(async (arrayBuffer) => {
                // calculate hash
                assetHash = crypto.createHash(hashType).update(Buffer.from(arrayBuffer)).digest('hex');
                assetSize = arrayBuffer.byteLength;
                fs.writeFileSync(path.join(EnvConfig.storage.uploads, `${assetHash}.${asset.type}`), Buffer.from(arrayBuffer));
            }).catch(err => {
                Logger.error(`Failed to download asset ${asset.id} (${asset.name}): ${err}`);
                return;
            });
            // #endregion
            if (!assetHash || assetHash.length === 0 || assetSize === 0) {
                Logger.error(`Failed to download asset ${asset.id} (${asset.name}), skipping...`);
                continue;
            }
            
            if (assetHash !== asset.hash) {
                Logger.warn(`Asset ${asset.id} (${asset.name}) hash mismatch: expected ${asset.hash}, got ${assetHash}. This may cause issues with the asset.`);
            }

            // #region thumbnail
            let thumbnailName = `image.png`;
            await fetch(asset.thumbnail.startsWith(`http`) ? asset.thumbnail :`https://modelsaber.com/files/${asset.type}/${asset.id}/${asset.thumbnail}`).then(res => res.arrayBuffer()).then(async (arrayBuffer) => {
                // calculate hash
                const hash = crypto.createHash(hashType).update(Buffer.from(arrayBuffer)).digest('hex');
                const format = asset.thumbnail.split('.').pop()?.toLowerCase() || 'png';
    
                if (format === 'mp4' || format === 'webm' || (arrayBuffer.byteLength > 8 * 1024 * 1024 && format === 'gif')) {
                    const oldFilePath = `${conversionStorage}/${hash}.${format}`;
                    // if the thumbnail is a video, convert it to a webp image
                    fs.writeFileSync(oldFilePath, Buffer.from(arrayBuffer));
                    if (ffmpegPath.default) {
                        throw new Error(`ffmpeg-static is not available. Please install it to convert video thumbnails.`);
                    }
                    const ff = new ffmpeg(oldFilePath);
                    await ff.then(video => {
                        return video
                            //.setVideoFormat('webp')
                            //.setVideoCodec('libwebp')
                            //.setVideoSize('512x512', true, false, `#000`)
                            .setVideoAspectRatio('1:1')
                            .setDisableAudio()
                            .save(path.join(thumbnailOutputDir, `${hash}.webp`), (error, file) => {
                                if (error) {
                                    Logger.error(`Failed to convert video thumbnail for asset ${asset.id}: ${JSON.stringify(error)}`);
                                }
                                thumbnailName = `${hash}.webp`;
                            });
                    }).catch(err => {
                        Logger.error(`Failed to convert video thumbnail for asset ${asset.id}: ${JSON.stringify(err)}`);
                    });
                } else {
                    if (arrayBuffer.byteLength > 8 * 1024 * 1024) {
                        Logger.warn(`Asset ${asset.id} thumbnail is larger than 8MB, reformatting...`);
                        sharp(Buffer.from(arrayBuffer))
                            .webp({ quality: 60 })
                            .toFile(path.join(thumbnailOutputDir, `${hash}.webp`), (err, info) => {
                                if (err) {
                                    Logger.error(`Failed to reformat thumbnail for asset ${asset.id}: ${err}`);
                                } else {
                                    Logger.log(`Reformatted thumbnail for asset ${asset.id} to ${info.size} bytes.`);
                                }
                                thumbnailName = `${hash}.webp`;
                            });
                    } else {
                        fs.writeFileSync(path.join(thumbnailOutputDir, `${hash}.${format}`), Buffer.from(arrayBuffer));
                        thumbnailName = `${hash}.${format}`;
                    }
                }
            })
            // #endregion
    
            // create asset in database
            Asset.create({
                oldId: asset.id,
                name: asset.name,
                description: `This asset was imported from the old ModelSaber.`,
                fileHash: assetHash,
                type: newType,
                fileSize: assetSize,
                iconNames: [thumbnailName],
                license: License.CC40_BY,
                uploaderId: asset.discordId || `5`,
                status: Status.Approved,
                tags: [],
                createdAt: new Date(asset.date),
            }).catch(err => {
                Logger.error(`Failed to create asset ${asset.id} (${asset.name}): ${err}`);
                Logger.error(`Asset data: ${JSON.stringify(err)}`);
                Logger.error(parseErrorMessage(err));
            });
        }
        fs.unlinkSync(conversionStorage);
        Logger.log(`Finished importing data from old ModelSaber.`);
    } catch (error) {
        Logger.error(`An error occurred while importing from old ModelSaber: ${error}`);
        Logger.error(JSON.stringify(error));
        Logger.error(parseErrorMessage(error));
        throw error;
    }
}