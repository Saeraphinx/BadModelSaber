
import { Asset, AssetFileFormat, AssetType, DatabaseManager, License, Status, UserRole } from '../src/shared/Database.ts';
import { faker } from '@faker-js/faker';

let db = new DatabaseManager(`./test/test.sqlite`);
db.init();

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

let testTags: string[] = [];
for (let i = 0; i < 50; i++) {
    testTags.push(faker.lorem.word());
}


for (let [index, role] of Object.values(UserRole).entries()) {
    await db.Users.create({
        id: faker.string.numeric(26),
        username: faker.internet.username({firstName: `John`, lastName: role}),
        displayName: faker.internet.displayName({firstName: `John`, lastName: role}),
        avatarUrl: `https://cdn.discordapp.com/embed/avatars/${index % 6}.png`,
        bio: faker.lorem.sentence(),
        sponsorUrl: faker.internet.url(),
        roles: [role],
    });
}

for (let type of Object.values(AssetType)) {
    for (let fileFormat of Object.values(AssetFileFormat)) {
        await db.Assets.create({
            id: 1,
            oldId: null,
            linkedIds: [],
            type: type,
            fileFormat: fileFormat,
            uploaderId: `test_uploader`,
            credits: [],
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