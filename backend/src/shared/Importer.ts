import { AlertType, Asset, AssetFileFormat, AssetPublicAPIv2, DefaultPermissionsObject, Game, License, LinkedAssetLinkType, Status, Tags, User, UserPermissions } from "./Database.ts";
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
const doAssetDownload = true; // set to false to skip downloading assets, useful for testing
const doTumbnailDownload = true; // set to false to skip downloading thumbnails, useful for testing

export async function importFromOldModelSaber(sendMessage: (messaage: string, type: `info` | `warn` | `error`) => void): Promise<void> {
    if (!EnvConfig.auth.discord.token) {
        Logger.error(`Discord token is not set in the environment variables. Please set DISCORD_TOKEN to import from old ModelSaber.`);
        sendMessage(`Discord token is not set in the environment variables. Please set DISCORD_TOKEN to import from old ModelSaber.`, `error`);
        return;
    }
    const discordRest = new REST({ version: '10' }).setToken(EnvConfig.auth.discord.token);
    const importerUser = await User.create({
        id: 6,
        username: `ModelSaber Importer`,
        displayName: `ModelSaber Importer`,
        avatarUrl: `https://cdn.discordapp.com/embed/avatars/6.png`,
        permissions: {sitewide: [UserPermissions.C_System], perGame: {}},
        bio: `This user was created by the ModelSaber importer for assets that couldn't be linked to a specific user during the importing process.`,
    });
    try {
        sendMessage(`Starting import from old ModelSaber...`, `info`);
        Logger.log(`Importing data from old ModelSaber...`);
        const modelSaberAll = await fetch(`https://modelsaber.com/api/v2/get.php`).then(res => res.json() as Promise<modelsaberasset>).catch(err => {
            sendMessage(`Failed to fetch old ModelSaber data: ${err}`, `error`);
            Logger.error(`Failed to fetch old ModelSaber data: ${err}`)
            throw err;
        });
        sendMessage(`Fetched ${Object.keys(modelSaberAll).length} assets from old ModelSaber.`, `info`);
        Logger.log(`Fetched ${Object.keys(modelSaberAll).length} assets from old ModelSaber.`);
        if (!fs.existsSync(conversionStorage)) {
            fs.mkdirSync(conversionStorage);
        }

        let i = 0;
        for (const [key, asset] of Object.entries(modelSaberAll)) {
            if (i++ % 50 === 0) {
                sendMessage(`Processing asset ${i}/${Object.keys(modelSaberAll).length} (${key})`, `info`);
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
                sendMessage(`Asset ${asset.id} (${asset.name}) already exists, skipping...`, `warn`);
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
                    sendMessage(`Unknown asset type ${asset.type} for asset ${asset.id}, skipping...`, `warn`);
                    Logger.warn(`Unknown asset type ${asset.type} for asset ${asset.id}, skipping...`);
                    continue;
            }
            // #endregion

            // #region download asset
            let assetHash = "";
            let assetSize = 0;
            let uri = /(https:\/\/modelsaber.com\/files\/\w+\/\d+\/)(.+)/gi.exec(asset.download);
            if (!uri || uri.length < 3) {
                sendMessage(`Failed to parse asset download URL for asset ${asset.id} (${asset.name}), skipping...`, `error`);
                Logger.error(`Failed to parse asset download URL for asset ${asset.id} (${asset.name}), skipping...`);
                continue;
            }
            let assetFileBuffer: ArrayBuffer | null = null;
            if (doAssetDownload) {
                assetFileBuffer = await fetch(`${uri[1]}${encodeURIComponent(uri[2])}`).then(res => {
                    if (!res.ok) {
                        sendMessage(`Failed to download asset ${asset.id} (${asset.name}): ${res.statusText}`, `error`);
                        throw new Error(`Failed to download asset ${asset.id} (${asset.name}): ${res.statusText}`);
                    }
                    return res.arrayBuffer()
                }).then(async (arrayBuffer) => {
                    // calculate hash
                    assetHash = crypto.createHash(hashType).update(Buffer.from(arrayBuffer)).digest('hex');
                    assetSize = arrayBuffer.byteLength;
                    return arrayBuffer;
                }).catch(err => {
                    sendMessage(`Failed to download asset ${asset.id} (${asset.name}): ${err}`, `error`);
                    Logger.error(`Failed to download asset ${asset.id} (${asset.name}): ${err}`);
                    return null;
                });
            } else {
                assetSize = 0;
                assetHash = asset.hash;
            }

            if (!assetHash || assetHash.length === 0 || assetSize === 0) {
                sendMessage(`Failed to download asset ${asset.id} (${asset.name}), skipping...`, `error`);
                Logger.error(`Failed to download asset ${asset.id} (${asset.name}), skipping...`);
                continue;
            }
            
            if (assetHash !== asset.hash) {
                sendMessage(`Asset ${asset.id} (${asset.name}) hash mismatch: expected ${asset.hash}, got ${assetHash}. This may cause issues with the asset.`, `warn`);
                Logger.warn(`Asset ${asset.id} (${asset.name}) hash mismatch: expected ${asset.hash}, got ${assetHash}. This may cause issues with the asset.`);
            }
            // #endregion

            // #region thumbnail
            let thumbnailName = `default.png`;
            let tempThumbnailFilePath = ``;
            let thumbnailOutputDir = path.join(EnvConfig.storage.uploads, `temp_thumbnails`);
            if (!fs.existsSync(thumbnailOutputDir)) {
                fs.mkdirSync(thumbnailOutputDir, { recursive: true });
            }
            if (doTumbnailDownload) {
                await fetch(asset.thumbnail.startsWith(`http`) ? asset.thumbnail :`https://modelsaber.com/files/${asset.type}/${asset.id}/${asset.thumbnail}`).then(res => res.arrayBuffer()).then(async (arrayBuffer) => {
                    const format = asset.thumbnail.split('.').pop()?.toLowerCase() ?? 'png';
                    // convert to webp if video or too large
                    if (format === 'mp4' || format === 'webm' || (arrayBuffer.byteLength > 8 * 1024 * 1024 && format === 'gif')) {
                        const oldFilePath = `${conversionStorage}/${new Date().getTime()}.${format}`;
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
                                .save(path.join(thumbnailOutputDir, `1.webp`), (error, file) => {
                                    if (error) {
                                        sendMessage(`Failed to convert video thumbnail for asset ${asset.id}: ${JSON.stringify(error)}`, `error`);
                                        Logger.error(`Failed to convert video thumbnail for asset ${asset.id}: ${JSON.stringify(error)}`);
                                    }
                                    thumbnailName = `1.webp`;
                                });
                        }).catch(err => {
                            sendMessage(`Failed to convert video thumbnail for asset ${asset.id}: ${JSON.stringify(err)}`, `error`);
                            Logger.error(`Failed to convert video thumbnail for asset ${asset.id}: ${JSON.stringify(err)}`);
                        });
                    } else {
                        if (arrayBuffer.byteLength > 8 * 1024 * 1024) {
                            sendMessage(`Thumbnail for asset ${asset.id} is larger than 8MB, reformatting...`, `warn`);
                            Logger.warn(`Asset ${asset.id} thumbnail is larger than 8MB, reformatting...`);
                            sharp(Buffer.from(arrayBuffer))
                                .webp({ quality: 60 })
                                .toFile(path.join(thumbnailOutputDir, `1.webp`), (err, info) => {
                                    if (err) {
                                        sendMessage(`Failed to reformat thumbnail for asset ${asset.id}: ${err}`, `error`);
                                        Logger.error(`Failed to reformat thumbnail for asset ${asset.id}: ${err}`);
                                    } else {
                                        sendMessage(`Reformatted thumbnail for asset ${asset.id} to ${info.size} bytes.`, `info`);
                                        Logger.log(`Reformatted thumbnail for asset ${asset.id} to ${info.size} bytes.`);
                                    }
                                    thumbnailName = `1.webp`;
                                });
                        } else {
                            fs.writeFileSync(path.join(thumbnailOutputDir, `1.${format}`), Buffer.from(arrayBuffer));
                            thumbnailName = `1.${format}`;
                        }
                    }
                }).catch(err => {
                    sendMessage(`Failed to download thumbnail for asset ${asset.id} (${asset.name}): ${err}`, `error`);
                    Logger.error(`Failed to download thumbnail for asset ${asset.id} (${asset.name}): ${err}`);
                });

                tempThumbnailFilePath = path.join(thumbnailOutputDir, thumbnailName);
            }

            if (thumbnailName === `default.png` && doTumbnailDownload) {
                sendMessage(`Asset ${asset.id} (${asset.name}) has no thumbnail, using default thumbnail.`, `warn`);
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
                            sendMessage(`Failed to fetch Discord user ${asset.discordid} for asset ${asset.id} (${asset.name}), skipping...`, `error`);
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
                        sendMessage(`Failed to fetch Discord user ${asset.discordid} for asset ${asset.id} (${asset.name}): ${err}`, `error`);
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
                            discordId: discordUser.id,
                            username: discordUser.username,
                            displayName: discordUser.global_name || discordUser.username,
                            avatarUrl: `https://cdn.discordapp.com/avatars/${discordUser.id}/${discordUser.avatar}.webp?animated=true`,
                            permissions: DefaultPermissionsObject,
                        }).catch(err => {
                            sendMessage(`Failed to create user ${discordUser.id} (${discordUser.username}): ${err}`, `error`);
                            Logger.error(`Failed to create user ${discordUser.id} (${discordUser.username}): ${err}`);
                            Logger.debug(`User data: ${JSON.stringify(discordUser)}`);
                            Logger.debug(parseErrorMessage(err));
                            return importerUser; // fallback to importer user
                        }).then(user => {
                            user.createAlert({
                                type: AlertType.Generic,
                                header: `Account Imported`,
                                message: `Hi ${user.displayName}! Your account has been imported from the old ModelSaber. If you notice any of your assets missing, please contact us and we will try to add them back to your profile.`,
                            });
                            return user;
                        });
                    } else {
                        return importerUser; // fallback to importer user
                    }
                } else {
                    if (!u) {
                        return importerUser; // fallback to importer user
                    } else {
                        return u;
                    }
                }
            }).catch(err => {
                sendMessage(`Failed to query user ${asset.discordid} (${asset.author}): ${err}`, `error`);
                Logger.error(`Failed to query user ${asset.discordid} (${asset.author}): ${err}`);
                return importerUser; // fallback to importer user
            });

            if (user.id === importerUser.id) {
                sendMessage(`Asset ${asset.id} (${asset.name}) could not be linked to a user, using importer user.`, `warn`);
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
                } else if (msTagProcessed.includes(`anima`)) {
                    tags.push(Tags.Animations);
                    break;
                }

                if (!tagAccepted) {
                    Logger.debug(`Asset ${asset.id} (${asset.name}) has unknown tag "${msTag}", skipping...`);
                }
            }

            // remove html tags from names
            let description = `This asset was imported from the old ModelSaber.\n\nTags: ${asset.tags.join(', ')}`;
            let name = asset.name.replaceAll(/<\/?[\w\d#=]+>/g, ``).trim();
            if (name.length >= 64) {
                name = name.slice(0, 64);
            }
            if (name != asset.name) {
                sendMessage(`Asset ${asset.id} (${asset.name}) name contained HTML tags, removing them.`, `warn`);
                Logger.warn(`Asset ${asset.id} (${asset.name}) name contained issues, removing them.`);
                description += `\nOriginal name: ${asset.name}`;
            }

            if (user.id === importerUser.id) {
                description += `\n\nThis asset was originally uploaded by ${asset.author}`;
            }
            // #endregion

            // create asset in database
            Asset.create({
                oldId: asset.id,
                name: name,
                description: description,
                fileHash: assetHash,
                type: newType,
                fileSafeName: Asset.convertNameToFileSafe(name),
                fileSize: assetSize,
                iconNames: [thumbnailName],
                license: License.Custom,
                licenseUrl: `https://modelsaber.com/info/unknown-license`,
                uploaderId: user.id || 6,
                status: Status.Verified,
                tags: tags as Tags[],
                gameName: (await Game.defaultGame).name,
                createdAt: new Date(asset.date),
            }).then((record) => {
                fs.mkdirSync(record.folderPath, { recursive: true });
                if (assetFileBuffer) {
                    fs.writeFileSync(record.assetFilePath, Buffer.from(assetFileBuffer));
                } else {
                    sendMessage(`Asset file buffer for asset ${asset.id} (${asset.name}) is null, skipping file save.`, `warn`);
                    Logger.warn(`Asset file buffer for asset ${asset.id} (${asset.name}) is null, skipping file save.`);
                }
                if (doTumbnailDownload && tempThumbnailFilePath && fs.existsSync(tempThumbnailFilePath)) {
                    fs.copyFileSync(tempThumbnailFilePath, path.join(record.folderPath, thumbnailName));
                } else {
                    sendMessage(`Thumbnail file for asset ${asset.id} (${asset.name}) does not exist, skipping thumbnail save.`, `warn`);
                    Logger.warn(`Thumbnail file for asset ${asset.id} (${asset.name}) does not exist, skipping thumbnail save.`);
                }
            }).catch(err => {
                sendMessage(`Failed to create asset ${asset.id} (${asset.name}): ${err}`, `error`);
                Logger.error(`Failed to create asset ${asset.id} (${asset.name}): ${err}`);
                Logger.debug(err);
                Logger.debug(parseErrorMessage(err));
            })
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
        //fs.rmSync(conversionStorage, { recursive: true, force: true });
        sendMessage(`Finished importing data from old ModelSaber.`, `info`);
        Logger.log(`Finished importing data from old ModelSaber.`);
    } catch (error) {
        sendMessage(`An error occurred while importing from old ModelSaber: ${parseErrorMessage(error)}`, `error`);
        Logger.error(`An error occurred while importing from old ModelSaber: ${error}`);
        Logger.error(JSON.stringify(error));
        Logger.error(parseErrorMessage(error));
        throw error;
    }
}