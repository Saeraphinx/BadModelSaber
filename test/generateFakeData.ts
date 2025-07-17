import * as fs from 'fs';

import { AlertType, Asset, AssetFileFormat, AssetType, DatabaseManager, License, Status, User, UserRole } from '../src/shared/Database.ts';
import { faker } from '@faker-js/faker';

export async function generateFakeData() {
    let db = new DatabaseManager();
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

    let testTags: string[] = [];
    for (let i = 0; i < 50; i++) {
        testTags.push(faker.lorem.word());
    }


    for (let [index, role] of Object.values(UserRole).entries()) {
        let user = await db.Users.create({
            id: faker.string.numeric(26),
            username: faker.internet.username({ firstName: `John`, lastName: role }),
            displayName: faker.internet.displayName({ firstName: `John`, lastName: role }),
            avatarUrl: `https://cdn.discordapp.com/embed/avatars/${index % 6}.png`,
            bio: faker.lorem.sentence(),
            sponsorUrl: faker.internet.url(),
            roles: [role],
        });
        users.push(user);
    }

    console.log(`Created ${users.length} users with roles`);

    let userCount = 0;
    for (let user of users) {
        console.log(`Creating entries for user ${++userCount}/${users.length}`);
        let usersExcludingCurrent = users.filter(u => u.id !== user.id);
        for (let count of [1, 2, 3, 4, 5, 6, 7, 8, 9, 10]) {
            for (let type of Object.values(AssetType)) {
                for (let fileFormat of Object.values(AssetFileFormat)) {
                    if (fileFormat.split('_')[0] !== type) {
                        continue; // Skip mismatched type and file format
                    }

                    await db.Assets.create({
                        oldId: count % 2 == 1 ? faker.string.numeric(10) : null, // Only set oldId for odd types
                        linkedIds: [],
                        type: type,
                        fileFormat: fileFormat,
                        uploaderId: user.id,
                        credits: [{
                            userId: faker.helpers.arrayElement(usersExcludingCurrent).id,
                            workDone: faker.lorem.words({ min: 1, max: 3 }),
                        }],
                        name: `${faker.lorem.words(2)} ${type} ${fileFormat}`,
                        description: `This is a test asset of type ${type} and format ${fileFormat}.\n${faker.lorem.paragraph()}`,
                        license: License.CC0,
                        licenseUrl: null,
                        sourceUrl: null,
                        fileHash: faker.git.commitSha(),
                        fileSize: faker.number.int({ min: 1000, max: 1000000 }),
                        iconNames: faker.helpers.arrayElements(testIcons, { min: 1, max: 5 }),
                        status: faker.helpers.arrayElement(Object.values(Status)),
                        tags: faker.helpers.arrayElements(testTags),
                    })
                }
            }
        }

        for (let count of faker.helpers.arrayElements([1, 2, 3, 4, 5, 6, 7, 8, 9, 10], { min: 1, max: 30 })) {
            await db.Alerts.create({
                header: `Test Alert ${count}`,
                message: `This is a test alert message number ${count} for user ${user.username}.`,
                userId: user.id,
                assetId: null,
                type: faker.helpers.arrayElement(Object.values(AlertType)),
                read: faker.datatype.boolean(),
            });
        }
    }

    console.log(`Generated fake data for ${users.length} users, ${await db.Assets.count()} assets, and ${await db.Alerts.count()} alerts.`);

    let data = await db.export();

    if (fs.existsSync(`./storage/fakeData.json`)) {
        fs.unlinkSync(`./storage/fakeData.json`);
    }

    fs.writeFileSync(`./storage/fakeData.json`, JSON.stringify(data, null, 0));
    console.log(`Fake data written to ../storage/fakeData.json`);

    await db.closeConnenction();
    return true;
}
