import { AlertType, Asset, AssetFileFormat, AssetPublicAPIv2, DatabaseManager, DefaultPermissionsObject, Game, GameVersion, License, LinkedAssetLinkType, ModApiv2, ModVersionsApiv2, Project, Status, Tags, User, UserPermissions, UserPublicApiV2, Version, VersionValidStatuses, RenderingModes } from "./Database.ts";
import { Logger } from "./Logger.ts";
import * as fs from "fs";
import * as crypto from "crypto";
import sharp from "sharp";
import ffmpegPath from "ffmpeg-static";
import ffmpeg from "ffmpeg";
import path from "path";
import { EnvConfig } from "./EnvConfig.ts";
import { Op } from "sequelize";
import { capitalizeWords, parseErrorMessage } from "./Tools.ts";
import { APIUser, REST, Routes } from "discord.js";
import { SemVer } from "semver";
import { getManifestFromZip } from "./ModParser.ts";
import z from "zod";
import { availableParallelism } from "os";
import JSZip from "jszip";

type modelsaberasset = {
    [key: string]: AssetPublicAPIv2;
}

const totalBeatmodsMods = 450; // set this to the total number of mods on BeatMods to get accurate progress reporting. Currently set to 0 to avoid accidentally hitting the BeatMods API during testing.
//const doModDownload = false; // set to true to download mod files from BeatMods, useful for testing the import process but not recommended for full imports due to the large number of mods and potential rate limits. Currently set to false to avoid accidentally hitting the BeatMods API during testing.
const doThumbnailDownload = true;
const doDecompile = true; // set to true to decompile mod files during import, which can help preserve metadata for mods that don't include a manifest but will significantly increase the time it takes to import each mod. Currently set to false to speed up testing.
const doParallelModProcessing = true; // set to true to process multiple mods in parallel, which can significantly decrease the time it takes to import all mods but may cause issues with resource usage. Currently set to true to speed up testing.
const hashType = `md5`;
const conversionStorage = `./storage/converts`;
const doAssetDownload = true; // set to false to skip downloading assets, useful for testing
const doTumbnailDownload = true; // set to false to skip downloading thumbnails, useful for testing

const zipUrl = `https://files.sae.sh/public/bbm_import.zip`;

export async function importFromOldModelSaber(): Promise<void> {
    if (!EnvConfig.auth.discord.token) {
        Logger.error(`Discord token is not set in the environment variables. Please set DISCORD_TOKEN to import from old ModelSaber.`);
        return;
    }
    const discordRest = new REST({ version: '10' }).setToken(EnvConfig.auth.discord.token);
    const importerUser = await User.create({
        username: `ModelSaber Importer`,
        displayName: `ModelSaber Importer`,
        avatarUrl: `https://cdn.discordapp.com/embed/avatars/6.png`,
        permissions: { sitewide: [UserPermissions.C_System], perGame: {} },
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

        let i = 0;
        for (const [key, asset] of Object.entries(modelSaberAll)) {
            if (i++ % 50 === 0) {
                Logger.log(`Processing asset ${i}/${Object.keys(modelSaberAll).length} (${key})`);
            }
            // #region prep
            // check if asset already exists
            const existingAsset = await Asset.findOne({
                where: {
                    [Op.or]: {
                        oldId: asset.id,
                        fileHash: asset.hash,
                    }
                }
            });

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
            let assetFileBuffer: ArrayBuffer | null = null;
            if (doAssetDownload) {
                assetFileBuffer = await fetch(`${uri[1]}${encodeURIComponent(uri[2])}`).then(res => {
                    if (!res.ok) {
                        throw new Error(`Failed to download asset ${asset.id} (${asset.name}): ${res.statusText}`);
                    }
                    return res.arrayBuffer()
                }).then(async (arrayBuffer) => {
                    // calculate hash
                    assetHash = crypto.createHash(hashType).update(Buffer.from(arrayBuffer)).digest('hex');
                    assetSize = arrayBuffer.byteLength;
                    return arrayBuffer;
                }).catch(err => {
                    Logger.error(`Failed to download asset ${asset.id} (${asset.name}): ${err}`);
                    return null;
                });
            } else {
                assetSize = 0;
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
            let tempThumbnailFilePath = ``;
            let thumbnailOutputDir = path.join(EnvConfig.storage.uploads, `temp_thumbnails`);
            if (!fs.existsSync(thumbnailOutputDir)) {
                fs.mkdirSync(thumbnailOutputDir, { recursive: true });
            }
            if (doTumbnailDownload) {
                await fetch(asset.thumbnail.startsWith(`http`) ? asset.thumbnail : `https://modelsaber.com/files/${asset.type}/${asset.id}/${asset.thumbnail}`).then(res => res.arrayBuffer()).then(async (arrayBuffer) => {
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
                                        
                                        Logger.error(`Failed to convert video thumbnail for asset ${asset.id}: ${JSON.stringify(error)}`);
                                    }
                                    thumbnailName = `1.webp`;
                                });
                        }).catch(err => {
                            Logger.error(`Failed to convert video thumbnail for asset ${asset.id}: ${JSON.stringify(err)}`);
                        });
                    } else {
                        if (arrayBuffer.byteLength > 8 * 1024 * 1024) {
                            Logger.warn(`Asset ${asset.id} thumbnail is larger than 8MB, reformatting...`);
                            sharp(Buffer.from(arrayBuffer))
                                .webp({ quality: 60 })
                                .toFile(path.join(thumbnailOutputDir, `1.webp`), (err, info) => {
                                    if (err) {
                                        Logger.error(`Failed to reformat thumbnail for asset ${asset.id}: ${err}`);
                                    } else {
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
                    Logger.error(`Failed to download thumbnail for asset ${asset.id} (${asset.name}): ${err}`);
                });

                tempThumbnailFilePath = path.join(thumbnailOutputDir, thumbnailName);
            }

            if (thumbnailName === `default.png` && doTumbnailDownload) {
                Logger.warn(`Asset ${asset.id} (${asset.name}) has no thumbnail, using default thumbnail.`);
            }
            // #endregion

            // #region user
            let user = await User.findOne({ where: { discordId : asset.discordid }}).then(async u => {
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
                            discordId: discordUser.id,
                            username: discordUser.username,
                            displayName: discordUser.global_name || discordUser.username,
                            avatarUrl: `https://cdn.discordapp.com/avatars/${discordUser.id}/${discordUser.avatar}.webp?animated=true`,
                            permissions: DefaultPermissionsObject,
                        }).catch(err => {
                            Logger.error(`Failed to create user ${discordUser.id} (${discordUser.username}): ${err}`);
                            Logger.debug(`User data: ${JSON.stringify(discordUser)}`);
                            Logger.debug(parseErrorMessage(err));
                            return importerUser; // fallback to importer user
                        }).then(user => {
                            user.createAlert({
                                type: AlertType.Generic,
                                header: `Account Imported`,
                                message: `Hi ${user.displayName}! Your account has been imported from the old ModelSaber. If you notice any of your assets missing, please contact us and we will try to add them back to your profile.`,
                            }, false);
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
                renderingMethod: RenderingModes.BIRP_SinglePass,
                gameName: (await Game.defaultGame).name,
                createdAt: new Date(asset.date),
            }).then((record) => {
                fs.mkdirSync(record.folderPath, { recursive: true });
                if (assetFileBuffer) {
                    fs.writeFileSync(record.assetFilePath, Buffer.from(assetFileBuffer));
                } else {
                    Logger.warn(`Asset file buffer for asset ${asset.id} (${asset.name}) is null, skipping file save.`);
                }
                if (doTumbnailDownload && tempThumbnailFilePath && fs.existsSync(tempThumbnailFilePath)) {
                    fs.copyFileSync(tempThumbnailFilePath, path.join(record.folderPath, thumbnailName));
                } else {
                    Logger.warn(`Thumbnail file for asset ${asset.id} (${asset.name}) does not exist, skipping thumbnail save.`);
                }
            }).catch(err => {
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
        Logger.log(`Finished importing data from old ModelSaber.`);
    } catch (error) {
        Logger.error(`An error occurred while importing from old ModelSaber: ${error}`);
        Logger.error(JSON.stringify(error));
        Logger.error(parseErrorMessage(error));
        throw error;
    }
}

export async function importFromBadBeatMods() {
    Logger.log(`'ere Jim, have a seat and let me tell you a tale that'll make your blood run cold.`);
    let startTime = Date.now();
    let totalStartTime = startTime;
    const importerUser = await User.create({
        id: 3,
        username: `BeatMods Import`,
        displayName: `BeatMods Importer`,
        avatarUrl: `https://cdn.discordapp.com/embed/avatars/6.png`,
        permissions: { sitewide: [UserPermissions.C_System], perGame: {} },
        bio: `This user was created by the BeatMods importer for mods that couldn't be linked to a specific user during the importing process.`,
    }).catch(async err => {
        Logger.error(`Failed to create importer user for BeatMods import: ${err}`);
        return await User.findByPk(3).then(user => {
            if (user) {
                return user;
            } else {
                throw new Error(`Failed to create importer user for BeatMods import, and user with ID 3 does not exist. This will cause all mods without a valid user to be linked to a non-existent user, which may cause issues. Please create a user with ID 3 and try again.`);
            }
        })
    });
    let mods: { mod: ModApiv2, versions: ModVersionsApiv2[] }[] = [];

    let requestInfo: RequestInit = {
    };

    if (EnvConfig.auth.github.token && EnvConfig.auth.github.token.length > 0) {
        let authTest = await fetch(`https://beatmods.com/api/user`, {
            headers: {
                Authorization: `Bearer ${EnvConfig.auth.github.token}`
            }
        });
        if (!authTest.ok) {
            Logger.error(`Failed to authenticate with BeatMods API using provided GitHub token.`);
            return;
        } else {
            Logger.log(`Successfully authenticated with BeatMods API using provided GitHub token.`);
        }
        requestInfo.headers = {
            Authorization: `Bearer ${EnvConfig.auth.github.token}`
        };
    } else {
        Logger.error(`No GitHub token provided for BeatMods API authentication.`);
    }

    if (!fs.existsSync(`./storage/import_cache/beatmods`)) {
        fs.mkdirSync(`./storage/import_cache/beatmods`, { recursive: true });
    }

    // if the mod already exists in the cache, we will skip fetching it from the API. otherwise, pull it from the api and cache it
    for (let modId = 1; modId <= totalBeatmodsMods; modId++) {
        if (fs.existsSync(`./storage/import_cache/beatmods/${modId}.json`)) {
            Logger.debug(`Mod ${modId} already exists in cache, skipping fetch.`);
            mods.push(JSON.parse(fs.readFileSync(`./storage/import_cache/beatmods/${modId}.json`, `utf-8`)));
        } else {
            try {
                let mod = await fetch(`https://beatmods.com/api/mods/${modId}`, requestInfo).then(res => res.json() as Promise<{ mod: { info: ModApiv2, versions: ModVersionsApiv2[] } }>);
                mods.push({
                    mod: mod.mod.info,
                    versions: mod.mod.versions,
                });
                // timeout for 500ms to avoid hitting rate limits
                await new Promise(resolve => setTimeout(resolve, 500));
                Logger.debug(`Fetched mod ${modId}: ${mod.mod.info.name}`);
                fs.writeFileSync(`./storage/import_cache/beatmods/${modId}.json`, JSON.stringify({
                    mod: mod.mod.info,
                    versions: mod.mod.versions,
                }));
                if (modId % 50 === 0 || modId === 1 || modId === totalBeatmodsMods) {
                    Logger.log(`Fetched ${modId}/${totalBeatmodsMods} mods from BeatMods...`);
                }
            } catch (error) {
                Logger.error(`Failed to fetch mod ${modId}: ${error}`);
            }
        }
    }
    Logger.debug(`Finished fetching mods from BeatMods. Total time: ${Date.now() - startTime}ms`);

    let newProjects = new Map<number, Project>();

    try {
        Logger.log(`Creating games...`);
        await Game.create({
            name: `beatsaber`,
            displayName: `Beat Saber`,
            default: true,
            categories: [
                `Core`,
                `Essential`,
                `Lighting`,
                `UI Enhancement`,
                `Gameplay`,
                `Multiplayer`,
                `Cosmetic`,
                `Leaderboard`,
                `Practice & Training`,
                `Tweaks & Tools`,
                `Streaming Tools`,
                `Text Replacement`,
                `Editor`,
                `Library`,
                `Other`,
            ],
            platforms: [
                `universal`,
                `steam`,
                `oculus`
            ],
            webhookConfig: []
        });

        await Game.create({
            name: `chromapper`,
            displayName: `ChroMapper`,
            default: false,
            categories: [
                `Core`,
                `Essential`,
                `Lighting`,
                `UI Enhancement`,
                `Gameplay`,
                `Multiplayer`,
                `Cosmetic`,
                `Leaderboard`,
                `Practice & Training`,
                `Tweaks & Tools`,
                `Streaming Tools`,
                `Text Replacement`,
                `Editor`,
                `Library`,
                `Other`,
            ],
            webhookConfig: []
        });
    } catch (error) {
        Logger.error(`Failed to create games: ${error}`);
    }

    if ((await Game.defaultGame).name !== `beatsaber`) {
        Logger.error(`Default game is not set to Beat Saber, aborting import to avoid potential issues. Please set the default game to Beat Saber and try again.`);
        return;
    }

    Logger.log(`Creating projects...`);
    const newUsers: Map<number, User> = new Map();
    let promises: Promise<void>[] = [];
    let specialIdCounter = totalBeatmodsMods + 1;
    for (const { mod, versions } of mods) {
        let idToUse = mod.id;
        if (mod.id === 143 || mod.id === 5 || mod.id === 69 /* for pink */) {
            idToUse = specialIdCounter;
            Logger.debug(`Assigning special ID ${specialIdCounter} to mod ${mod.id} (${mod.name})`);
            specialIdCounter++;
        }

        for (const author of mod.authors) {
            let user = await getNewUserFromOldUser(author);
            newUsers.set(author.id, user);
        }

        let newGameName = mod.gameName.toLowerCase();

        if (z.url().safeParse(mod.gitUrl).success === false) {
            mod.gitUrl = `https://beatmods.com/mod/${idToUse}`;
        }

        promises.push(Project.create({
            id: idToUse,
            name: mod.name,
            nameId: mod.name.replaceAll(` `, ``), // previously nameid was enforecd to just be the same
            gameName: newGameName,
            description: mod.description,
            category: translateBeatModsCategory(mod.name, mod.category),
            gitUrl: mod.gitUrl,
            summary: mod.summary,
            lastUpdatedById: importerUser.id,
            iconFileName: mod.iconFileName == `default.png` ? `default_${newGameName}.png` : mod.iconFileName,
            createdAt: new Date(mod.createdAt),
            updatedAt: new Date(mod.updatedAt),
            statusHistory: mod.statusHistory.map(sh => ({
                status: sh.status as Status,
                reason: sh.reason,
                timestamp: new Date(sh.setAt).toISOString(),
                userId: newUsers.get(sh.userId)?.id || importerUser.id,
            })),
            status: mod.status == `verified` || mod.status == `pending` ? Status.Public : Status.Private,
            lastApprovedById: mod.status === Status.Verified ? importerUser.id : undefined,
        }).then(async project => {
            project.$set(`authors`, mod.authors.map(a => newUsers.get(a.id)?.id || importerUser.id)).catch(err => {
                Logger.error(`Failed to set authors for project ${project.id} (${project.name}): ${err}`);
            });
            newProjects.set(mod.id, project);
            fs.mkdirSync(project.folderPath, { recursive: true });
        }));
    }

    await Promise.all(promises).then(() => {
        Logger.log(`Finished importing projects for all mods.`);
    }).catch(err => {
        Logger.error(`Failed to import projects: ${err}`);
    });

    // download icons
    if (doThumbnailDownload) {
        Logger.log(`Downloading icons for projects...`);
        startTime = Date.now();
        for (let project of newProjects.values()) {
            if (project.iconFileName && project.iconFileName === `default_beatsaber.png` || project.iconFileName === `default_chromapper.png`) {
                continue;
            }
            if (fs.existsSync(path.join(project.folderPath, project.iconFileName))) {
                Logger.debug(`Icon for project ${project.id} (${project.name}) already exists, skipping download.`);
                continue;
            }
            await new Promise(resolve => setTimeout(resolve, 300)); // small delay to avoid ratelimit
            Logger.debug(`Downloading icon for project ${project.id} (${project.name})...`);
            await fetch(`https://beatmods.com/cdn/icon/${project.iconFileName}`).then(res => {
                if (!res.ok) {
                    Logger.error(`Failed to download icon for project ${project.id} (${project.name}): ${res.statusText}`);
                    return null;
                }
                return res.arrayBuffer();
            }).then(arrayBuffer => {
                if (!arrayBuffer) {
                    return;
                }

                fs.writeFileSync(path.join(project.folderPath, project.iconFileName), Buffer.from(arrayBuffer));
            }).catch(err => {
                Logger.error(`Failed to download icon for project ${project.id} (${project.name}): ${err}`);
            });
        }
        Logger.log(`Finished downloading icons for projects. Time taken: ${Date.now() - startTime}ms`);
    }

    // import versions
    Logger.log(`Importing versions for mods...`);
    startTime = Date.now();
    for (const { mod, versions } of mods) {
        const project = newProjects.get(mod.id);
        if (!project) {
            Logger.error(`Project not found for mod ${mod.id} (${mod.name}), skipping versions...`);
            continue;
        }
        let versionPromises: Promise<Version>[] = [];
        Logger.log(`Importing versions for mod ${mod.id} (${mod.name})...`);
        for (const version of versions) {
            let dependencies: { pId: number, sv: string }[] = [];
            let gameVersionIds: number[] = [];
            for (const dep of version.dependencies) {
                // find version with matching id (have to search through every mod)
                const depVer = mods.find(pv => pv.versions.find(v => v.id === dep))?.versions.find(v => v.id === dep);
                const pId = depVer ? newProjects.get(depVer.modId)?.id : null;
                if (depVer && pId) {
                    dependencies.push({
                        pId: pId || 0,
                        sv: `^${depVer.modVersion}`,
                    });
                } else {
                    Logger.warn(`Dependency with id ${dep} not found for version ${version.id} of mod ${mod.id} (${mod.name}), skipping dependency...`);
                }
            }

            let gameVerPromises: Promise<GameVersion>[] = [];
            for (const gv of version.supportedGameVersions) {
                gameVerPromises.push(GameVersion.findOrCreate({
                    where: {
                        gameName: project.gameName,
                        version: gv.version,
                    },
                    defaults: {
                        gameName: project.gameName,
                        version: gv.version,
                        createdAt: gv.createdAt
                    }
                }).then((record) => {
                    return record[0];
                }))
            }
            let newGameVers = await Promise.all(gameVerPromises);

            versionPromises.push(Version.create({
                projectId: project.id,
                semver: new SemVer(version.modVersion),
                contentHashes: version.contentHashes,
                fileSize: version.fileSize,
                zipHash: version.zipHash,
                // remove last 2 chars since theyre basically always "pc"
                platform: version.platform.slice(0, -2),
                uploaderId: newUsers.get(version.author.id)?.id || importerUser.id,
                dependencies: dependencies,
                lastUpdatedById: importerUser.id,
                createdAt: new Date(version.createdAt),
                updatedAt: new Date(version.updatedAt),
                status: version.status == `pending` ? Status.Queue : version.status as VersionValidStatuses,
                statusHistory: version.statusHistory.map(sh => ({
                    status: version.status == `pending` ? Status.Queue : version.status as Status,
                    reason: sh.reason,
                    timestamp: new Date(sh.setAt).toISOString(),
                    userId: newUsers.get(sh.userId)?.id || importerUser.id,
                })),
                lastApprovedById: version.status === Status.Verified ? importerUser.id : undefined,
            }).then(async v => {
                await v.$set(`supportedGameVersions`, newGameVers).catch(err => {
                    Logger.error(`Failed to set game versions for version ${v.id} of mod ${mod.id} (${mod.name}): ${err}`);
                });
                return v;
            }));
        }

        const awaitedVersions = await Promise.all(versionPromises).then((versions) => {
            Logger.log(`Finished importing versions for mod ${mod.id} (${mod.name})`);
            return versions;
        });

        Logger.log(`Starting file processing for versions of mod ${mod.id} (${mod.name})...`);
        let zipParsingPromises: (() => Promise<void>)[] = [];
        for (const version of awaitedVersions.reverse()) {
            Logger.debug(`Downloading and processing files for version ${version.id} of mod ${mod.id} (${mod.name} ${version.semver.raw})...`);
            // download files & process dlls
            
            // check if the zip file already exists locally
            let zipBuffer: Buffer<ArrayBuffer> | undefined
            let alreadyExists = fs.existsSync(path.join(version.versionFolderPath, version.zipFileName));
            if (alreadyExists) {
                zipBuffer = fs.readFileSync(path.join(version.versionFolderPath, version.zipFileName));
                Logger.debug(`Found existing zip file for version ${version.id} of mod ${mod.id} (${mod.name}), using local copy.`);
            } else {
                zipBuffer = await fetch(`https://beatmods.com/cdn/mod/${version.zipHash}.zip`).then(res => {
                    if (!res.ok) {
                        Logger.error(`Failed to download file for version ${version.id} of mod ${mod.id} (${mod.name}): ${res.statusText}`);
                        return null;
                    }
                    return res.arrayBuffer();
                }).then(async arrayBuffer => {
                    if (!arrayBuffer) {
                        return;
                    }
                    fs.mkdirSync(version.versionFolderPath, { recursive: true });
                    fs.writeFileSync(path.join(version.versionFolderPath, version.zipFileName), Buffer.from(arrayBuffer));
                    return Buffer.from(arrayBuffer);
                });
            }

            Logger.debug(`Finished downloading & extracting files for version ${version.id} of mod ${mod.id} (${mod.name} ${version.semver.raw}), starting async zip processing...`);

            if (!zipBuffer) {
                Logger.error(`Zip buffer is null for version ${version.id} of mod ${mod.id} (${mod.name}), skipping file processing...`);
                continue;
            }

            // Ensure the project is loaded before processing the zip
            let projectInstance = await version.project
            
            zipParsingPromises.push(async () => {
                await getManifestFromZip(zipBuffer!, null/*, Logger*/).then(async m => {
                    fs.writeFileSync(path.join(version.versionFolderPath, version.manifestName), JSON.stringify(m));
                    // @ts-expect-error
                    zipBuffer = null; // free up memory
                    if (m?.id && m?.id.length > 0 && projectInstance && projectInstance.nameId !== m.id && projectInstance?.id !== 1) {
                        // update the project's nameId based on the manifest ID
                        Logger.log(`Updating project nameId for project ${projectInstance.id} (${projectInstance.name}) to ${m.id}`);
                        projectInstance?.update({
                            nameId: m.id
                        });
                    }
                }).catch(err => {
                    Logger.error(`Failed to extract manifest from zip for version ${version.id} of mod ${mod.id} (${mod.name}): ${err}`);
                })
            });

            if (doDecompile && project.name !== `BSIPA`) {
                zipParsingPromises.push(async () => {
                    await version.dotnetDecompile().then(() => {
                        Logger.debug(`Finished decompilation for version ${version.id} of mod ${mod.id} (${mod.name} ${version.semver.raw})`);
                    }).catch(err => {
                        Logger.error(`Failed to decompile DLL for version ${version.id} of mod ${mod.id} (${mod.name} ${version.semver.raw}): ${err}`);
                    })
                });
            }
            if (!doParallelModProcessing) {
                await Promise.all(zipParsingPromises).catch(err => {
                    Logger.error(`Failed to process zip for version ${version.id} of mod ${mod.id} (${mod.name}): ${err}`);
                });
                zipParsingPromises = [];
            }
            if (!alreadyExists) {
                await new Promise(resolve => setTimeout(resolve, 400)); // wait a bit for ratelimits
            }
        }
        Logger.debug(`File processing started for all versions of mod ${mod.id} (${mod.name}), (time: ${Date.now() - startTime}ms)`);
        await limitConcurrency(zipParsingPromises, availableParallelism()).then(() => {
            Logger.log(`Finished processing files for all versions of mod ${mod.id} (${mod.name}). Total time: ${Date.now() - startTime}ms`);
        }).catch(err => {
            Logger.error(`Failed to process files for versions of mods: ${err}`);
        });
    }
    Logger.log(`Finished importing ${totalBeatmodsMods} mods from BeatMods.`);
    Logger.log(`Total time: ${Date.now() - totalStartTime}ms`);
}

async function getNewUserFromOldUser(user: UserPublicApiV2): Promise<User> {
    return await User.findOrCreate({
        where: {
            username: user.username,
        },
        defaults: {
            username: user.username,
            displayName: user.displayName,
            githubId: user.githubId?.toString(),
            permissions: DefaultPermissionsObject,
            avatarUrl: `https://github.com/${user.username}.png`,
            bio: user.bio,
            createdAt: user.createdAt
        }
    }).then(result => {
        if (result[1]) {
            Logger.debug(`Created new user ${user.username} from old user data.`);
            result[0].createAlert({
                type: AlertType.Generic,
                header: `BeatMods Account Imported`,
                message: `Hi ${result[0].displayName}! Your account has been imported from the old BeatMods. If you notice any of your mods missing, please contact us and we will add them back to your profile.`,
            }, false);
        }
        return result[0]
    }).catch(err => {
        Logger.error(`Failed to create or find user ${user.username}: ${err}`);
        throw err;
    });
}

function translateBeatModsCategory(modName: string, category: string): string {
    switch (modName.toLowerCase()) {
        case `beatleader`:
        case `scoresaber`:
        case `hitbloq`:
            return `Leaderboard`;
        default:
            break;
    }

    switch (category.toLowerCase()) {
        case `ui`:
            return `UI Enhancement`;
        case `practice`:
            return `Practice & Training`;
        case `streamtools`:
            return `Streaming Tools`;
        case `text`:
            return `Text Replacement`;
        case `tweaks`:
            return `Tweaks & Tools`;
        default:
            // capitalize first letter
            return capitalizeWords(category);
    }
}

async function limitConcurrency(tasks: (() => Promise<any>)[], concurrency: number): Promise<any[]> {
    const results: any[] = [];
    const queue = [...tasks];

    async function worker() {
        while (queue.length > 0) {
            const task = queue.pop();
            if (!task) {
                continue; // skip if task is undefined
            }
            results.push(await task());
        }
    }

    // Start the specified number of parallel workers
    await Promise.all(Array.from({ length: concurrency }, worker));
    return results;
}