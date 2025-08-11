import { Asset, AssetFileFormat, AssetPublicAPIv2, License, LinkedAssetLinkType, Status, Tags, User, UserRole } from "./Database.ts";
import { Logger } from "./Logger.ts";
import * as fs from "fs";
import * as crypto from "crypto";
import sharp from "sharp";
import ffmpegPath from "ffmpeg-static";
import ffmpeg from "ffmpeg";
import path from "path";
import { EnvConfig } from "./EnvConfig.ts";
import { Op } from "sequelize";
import { parseErrorMessage } from "./Tools.ts";
import { APIUser, REST, Routes } from "discord.js";

type modelsaberasset= {
    [key: string]: AssetPublicAPIv2;
}

const hashType = `md5`;
const conversionStorage = `./storage/converts`;
const doAssetDownload = false; // set to false to skip downloading assets, useful for testing
const doTumbnailDownload = true; // set to false to skip downloading thumbnails, useful for testing

export async function importFromOldModelSaber(): Promise<void> {
    if (!EnvConfig.auth.discord.token) {
        Logger.error(`Discord token is not set in the environment variables. Please set DISCORD_TOKEN to import from old ModelSaber.`);
        return;
    }
    const discordRest = new REST({ version: '10' }).setToken(EnvConfig.auth.discord.token);
    const importerUser = await User.create({
        id: `6`,
        username: `ModelSaber Importer`,
        displayName: `ModelSaber Importer`,
        avatarUrl: `https://cdn.discordapp.com/embed/avatars/6.png`,
        roles: [UserRole.Developer],
        bio: `This user was created by the ModelSaber importer for assets that couldn't be linked to a specific user during the importing process.`,
    });
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
            // #region prep
            // check if asset already exists
            const existingAsset = await Asset.findOne({ where: { 
                [Op.or]: {
                    oldId: asset.id,
                    fileHash: asset.hash,
                }
            } });

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
            // #endregion

            // #region download asset
            let assetHash = "";
            let assetSize = 0;
            let uri = /(https:\/\/modelsaber.com\/files\/\w+\/\d+\/)(.+)/gi.exec(asset.download);
            if (!uri || uri.length < 3) {
                Logger.error(`Failed to parse asset download URL for asset ${asset.id} (${asset.name}), skipping...`);
                continue;
            }
            if (!fs.existsSync(path.join(EnvConfig.storage.uploads, `${asset.hash}.${asset.type}`)) && doAssetDownload) {
                await fetch(`${uri[1]}${encodeURIComponent(uri[2])}`).then(res => {
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
            } else {
                assetSize = doAssetDownload ? fs.statSync(path.join(EnvConfig.storage.uploads, `${asset.hash}.${asset.type}`)).size : Math.floor(Math.random() * 1000000);
                assetHash = asset.hash;
            }

            if (!assetHash || assetHash.length === 0 || assetSize === 0) {
                Logger.error(`Failed to download asset ${asset.id} (${asset.name}), skipping...`);
                continue;
            }
            
            if (assetHash !== asset.hash) {
                Logger.warn(`Asset ${asset.id} (${asset.name}) hash mismatch: expected ${asset.hash}, got ${assetHash}. This may cause issues with the asset.`);
            }
            // #endregion

            // #region thumbnail
            let thumbnailName = `default.png`;
            if (doTumbnailDownload) {
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
            }

            if (thumbnailName === `default.png` && doTumbnailDownload) {
                Logger.warn(`Asset ${asset.id} (${asset.name}) has no thumbnail, using default thumbnail.`);
            }
            // #endregion

            // #region user
            let user = await User.findByPk(asset.discordid).then(async u => {
                if (!u && asset.discordid) {
                    // create user
                    if (asset.discordid === `-1`) {
                        return importerUser;
                    }
                    let discordUser = await discordRest.get(Routes.user(asset.discordid)).then(async (res) => {
                        if (!res) {
                            Logger.error(`Failed to fetch Discord user ${asset.discordid} for asset ${asset.id} (${asset.name}), skipping...`);
                            return {
                                id: `0`,
                                username: `Unknown`,
                                avatar: null,
                                global_name: null,
                            };
                        }
                        return res as APIUser;
                    }).catch(err => {
                        Logger.error(`Failed to fetch Discord user ${asset.discordid} for asset ${asset.id} (${asset.name}): ${err}`);
                        return {
                            id: `0`,
                            username: `Unknown`,
                            avatar: null,
                            global_name: null,
                        };
                    });

                    if (discordUser.id !== `0`) {
                        return await User.create({
                            id: discordUser.id,
                            username: discordUser.username,
                            displayName: discordUser.global_name || discordUser.username,
                            avatarUrl: `https://cdn.discordapp.com/assets/${discordUser.id}/${discordUser.avatar}.webp`,
                            roles: [],
                        }).catch(err => {
                            Logger.error(`Failed to create user ${discordUser.id} (${discordUser.username}): ${err}`);
                            Logger.debug(`User data: ${JSON.stringify(discordUser)}`);
                            Logger.debug(parseErrorMessage(err));
                            return importerUser; // fallback to importer user
                        });
                    } else {
                        return importerUser; // fallback to importer user
                    }
                } else {
                    return importerUser
                }
            }).catch(err => {
                Logger.error(`Failed to query user ${asset.discordid} (${asset.author}): ${err}`);
                return importerUser; // fallback to importer user
            });

            if (user.id === importerUser.id) {
                Logger.debug(`Asset ${asset.id} (${asset.name}) has invalid Discord ID (${asset.discordid}), using importer user.`);
            }
            // #endregion
            
            // #region data cleanup
            const systemTags = Object.values(Tags) as string[]
            let tags: string[] = [];
            for (const msTag of asset.tags) {
                let tagAccepted = false;
                let msTagProcessed = msTag.toLowerCase().replaceAll(/[_\- ]/g, ``);
                // remove plural 's' from the end of the tag if it exists
                if (msTagProcessed.endsWith(`s`)) {
                    msTagProcessed = msTagProcessed.slice(0, -1);
                }
                for (const systemTag of systemTags as Tags[]) {
                    let systemTagLower = systemTag.toLowerCase().replaceAll(` `, ``);
                    if (systemTagLower.endsWith(`s`)) {
                    systemTagLower = systemTagLower.slice(0, -1);
                }
                    if (msTagProcessed === systemTagLower) {
                        tags.push(systemTag);
                        tagAccepted = true;
                        break;
                    }
                }

                if (msTagProcessed.includes(`funny`)) {
                    tags.push(Tags.Meme);
                    break;
                } else if (msTagProcessed.includes(`particle`)) {
                    tags.push(Tags.Particles);
                    break;
                } else if (msTagProcessed.includes(`full body tracking`)) {
                    tags.push(Tags.FBT);
                    break;
                }

                if (!tagAccepted) {
                    Logger.debug(`Asset ${asset.id} (${asset.name}) has unknown tag "${msTag}", skipping...`);
                }
            }

            // remove html tags from names
            let description = `This asset was imported from the old ModelSaber.\n\nTags: ${asset.tags.join(', ')}`;
            let name = asset.name.replaceAll(/<\/?[\w\d#=]+>/g, ``).trim();
            if (name != asset.name) {
                Logger.warn(`Asset ${asset.id} (${asset.name}) name contained tags, removing them.`);
                description += `\nOriginal name: ${asset.name}`;
            }
            // #endregion



            // create asset in database
            Asset.create({
                oldId: asset.id,
                name: name,
                description: description,
                fileHash: assetHash,
                type: newType,
                fileSize: assetSize,
                iconNames: [thumbnailName],
                license: License.CC40_BY,
                uploaderId: user.id || `6`,
                status: Status.Approved,
                tags: tags as Tags[],
                createdAt: new Date(asset.date),
            }).catch(err => {
                Logger.error(`Failed to create asset ${asset.id} (${asset.name}): ${err}`);
                Logger.debug(`Asset data: ${JSON.stringify(err)}`);
                Logger.debug(parseErrorMessage(err));
            });
        }

        //#region variations
        for (const [key, asset] of Object.entries(modelSaberAll)) {
            if (!asset.variationid || asset.variationid === asset.id) {
                continue;
            }
            const baseAsset = await Asset.findOne({ where: { oldId: asset.variationid } });
            const newAsset = await Asset.findOne({ where: { oldId: asset.id } });
            if (!baseAsset || !newAsset) {
                continue;
            }
            await baseAsset.addLink(newAsset, LinkedAssetLinkType.Alternate);
        }
        await new Promise(resolve => setTimeout(resolve, 5000)); // wait for all assets to be created
        fs.rmSync(conversionStorage, { recursive: true, force: true });
        Logger.log(`Finished importing data from old ModelSaber.`);
    } catch (error) {
        Logger.error(`An error occurred while importing from old ModelSaber: ${error}`);
        Logger.error(JSON.stringify(error));
        Logger.error(parseErrorMessage(error));
        throw error;
    }
}