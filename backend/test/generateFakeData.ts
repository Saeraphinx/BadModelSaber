import * as fs from 'fs';

import { Alert, AlertType, Asset, AssetFileFormat, AssetValidStatusesArray, DatabaseManager, Game, GameVersion, License, LinkedAssetLinkType, PlatformType, Project, ProjectValidStatusesArray, Status, Tags, User, UserPermissions, UserPlatform, Version, VersionValidStatusesArray } from '../src/shared/Database.ts';
import { faker } from '@faker-js/faker';
import { Op } from 'sequelize';
import { SemVer } from 'semver';

export async function generateFakeData(connectionString?: string): Promise<boolean> {
    //EnvConfig.load();
    let db = new DatabaseManager(`generateFakeData`, connectionString);
    await db.init();

    const testIcons = [
        `icon1.png`,
        `icon2.jpg`,
        `icon3.gif`,
        `icon4.webp`,
        `icon5.png`,
        `icon6.jpg`,
        `icon7.gif`,
        `icon8.webp`,
    ];

    let users: User[] = []

    let sponserUrls: UserPlatform[] = [
        { platform: PlatformType.Patreon, url: `https://www.patreon.com/beatsabermoddinggroup` },
        { platform: PlatformType.KoFi, url: `https://ko-fi.com/BadModelSaber` },
        { platform: PlatformType.GitHub, url: `https://github.com/Saeraphinx/support` },
    ]

    await Game.create({
        name: `beatsaber`,
        displayName: `Beat Saber`,
        default: true,
        webhookConfig: []
    })

    let gameVersionIds: number[] = [];

    await GameVersion.create({
        gameName: `beatsaber`,
        version: `1.30.0`,
    }).then((gameVersion) => {
        gameVersionIds.push(gameVersion.id);
    });

    await GameVersion.create({
        gameName: `beatsaber`,
        version: `1.31.0`,
    }).then((gameVersion) => {
        gameVersionIds.push(gameVersion.id);
    });

    await Game.create({
        name: `chromapper`,
        displayName: `ChroMapper`,
        default: false,
        webhookConfig: []
    })

    for (let [index, role] of Object.values(UserPermissions).entries()) {
        let user = await User.create({
            discordId: faker.number.int({ min: 100000000000000000, max: 999999999999999999 }).toString(),
            username: faker.internet.username({ firstName: `John`, lastName: role }),
            displayName: faker.internet.displayName({ firstName: `John`, lastName: role }),
            avatarUrl: `https://cdn.discordapp.com/embed/avatars/${index % 6}.png`,
            bio: faker.lorem.sentence(),
            userPlatforms: faker.helpers.arrayElements(sponserUrls, { min: 0, max: 3 }),
            permissions: {
                sitewide: [role],
                perGame: {}
            }
        });
        let perGameUser = await User.create({
            discordId: faker.number.int({ min: 100000000000000000, max: 999999999999999999 }).toString(),
            username: faker.internet.username({ firstName: `Johnbs`, lastName: role }),
            displayName: faker.internet.displayName({ firstName: `Johnbs`, lastName: role }),
            avatarUrl: `https://cdn.discordapp.com/embed/avatars/${index % 6}.png`,
            bio: faker.lorem.sentence(),
            userPlatforms: faker.helpers.arrayElements(sponserUrls, { min: 0, max: 3 }),
            permissions: {
                sitewide: [],
                perGame: {
                    beatsaber: [role]
                }
            }
        });
        users.push(user);
        users.push(perGameUser);
    }

    if (db.adminUser) {
        users.push(db.adminUser);
    }

    console.log(`Created ${users.length} users with roles`);

    let userCount = 0;
    for (let user of users) {
        console.log(`Creating entries for user ${++userCount}/${users.length}`);
        let assetIds: number[] = [];
        let usersExcludingCurrent = users.filter(u => u.id !== user.id);
        let awaitingPromises: Promise<any>[] = [];
        for (let count of [1]) {
            for (let type of Object.values(AssetFileFormat)) {
                awaitingPromises.push(Asset.create({
                    oldId: count % 2 == 1 ? faker.number.int({ min: 1000000, max: 99999999 }) : null, // Only set oldId for odd types
                    linkedIds: [],
                    type: type,
                    uploaderId: user.id,
                    collaboratorIds: faker.helpers.arrayElements(usersExcludingCurrent, { min: 0, max: 3 }).map(u => u.id),
                    name: `${faker.lorem.words(2)} ${type}`,
                    description: `This is a test asset of type ${type}.\n${faker.lorem.paragraph()}`,
                    license: License.CC0,
                    licenseUrl: null,
                    sourceUrl: null,
                    fileSafeName: `${faker.lorem.words(1)}.${type.split(`_`)[1].toLowerCase()}`,
                    fileHash: faker.git.commitSha(),
                    fileSize: faker.number.int({ min: 1000, max: 1000000 }),
                    iconNames: faker.helpers.arrayElements(testIcons, { min: 1, max: 5 }),
                    status: faker.helpers.arrayElement(AssetValidStatusesArray),
                    gameName: `beatsaber`,
                    tags: faker.helpers.arrayElements(Object.values(Tags), { min: 0, max: 5 }),
                }).then((asset) => {
                    assetIds.push(asset.id);
                    return asset;
                }));
            }

            for (let status of ProjectValidStatusesArray) {
                awaitingPromises.push(Project.create({
                    name: `${faker.lorem.words(1)} ${status}`,
                    nameId: faker.helpers.slugify(faker.lorem.words(2)).toLowerCase(),
                    description: faker.lorem.paragraph(),
                    collaboratorIds: faker.helpers.arrayElements(usersExcludingCurrent, { min: 0, max: 3 }).map(u => u.id),
                    status: status,
                    gameName: `beatsaber`,
                    category: `Other`,
                    summary: faker.lorem.sentence(),
                    iconFileName: faker.helpers.arrayElement(testIcons),
                    gitUrl: faker.internet.url(),
                    lastUpdatedById: user.id,
                }).then(async (project) => {
                    await project.$add(`authors`, user);
                    for (const vs of VersionValidStatusesArray) {                       
                        return await Version.create({
                            projectId: project.id,
                            semver: new SemVer(`${faker.number.int({ min: 0, max: 3 })}.${faker.number.int({ min: 0, max: 10 })}.${faker.number.int({ min: 0, max: 20 })}`),
                            contentHashes: [{
                                path: `content/${faker.lorem.word()}.zip`,
                                hash: faker.git.commitSha(),
                            }],
                            fileSize: faker.number.int({ min: 1000, max: 1000000 }),
                            dependencies: [],
                            lastUpdatedById: user.id,
                            platform: `universal`,
                            status: vs,
                            uploaderId: user.id,
                            zipHash: faker.git.commitSha(),
                        }).then(async (version) => {
                            await version.$set(`supportedGameVersions`, faker.helpers.arrayElements(gameVersionIds, { min: 1, max: gameVersionIds.length }));
                            return version;
                        });
                    }
                }));
            }
        }
        await Promise.all(awaitingPromises);
    }

    for (let user of users) {
        let userAsset = await Asset.findOne({ where: { uploaderId: user.id } });
        if (!userAsset) throw new Error(`No asset found for user ${user.id}`);
        await Asset.findAll({
            where: {
                uploaderId: {
                    [Op.ne]: user.id
                },
                [Op.not]: {
                    collaboratorIds: {
                        [Op.contains]: [user.id]
                    }
                }
            }, include: { all: true }, offset: faker.number.int({ min: 0, max: 10 }), limit: 6
        }).then(async assets => {
            let i = 0;
            for (let asset of assets) {
                let author = await asset.uploader;
                if (!author) throw new Error(`Author not found for asset ${asset.id}`);
                switch (i++ % 3) {
                    case 0:
                        asset.requestCollab(author, user);
                        break;
                    case 1:
                        asset.requestLink(author, userAsset, faker.helpers.arrayElement(Object.values(LinkedAssetLinkType)))
                        break;
                    case 2:
                        asset.report(user, `This is a test report for asset ${asset.id}.`);
                        break;
                }

            }
        })
    }

    console.log(`Generated fake data for ${users.length} users, ${await Asset.count()} assets, and ${await Alert.count()} alerts.`);
    let data = await db.export();

    if (fs.existsSync(`./storage/fakeData.json`)) {
        fs.unlinkSync(`./storage/fakeData.json`);
    }

    fs.writeFileSync(`./storage/fakeData.json`, JSON.stringify(data, null, 0));
    console.log(`Fake data written to ../storage/fakeData.json`);

    await db.dropSchema();
    await db.closeConnenction();
    return true;
}

if (process.argv[1] === import.meta.filename) {
    generateFakeData()
}