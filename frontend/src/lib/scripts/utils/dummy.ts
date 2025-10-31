import { type AssetPublicAPIv3, AssetFileFormat, Status } from "../api/DBTypes";

// export const dummyAssetData: AssetPublicAPIv3 = {
//     id: 1,
//     name: `Asset 1`,
//     oldId: `123456789`,
//     linkedIds: [],
//     type: AssetType.ChromaEnvironment,
//     fileFormat: AssetFileFormat.JSON,
//     author: {
//       id: "123456789123456789123456789",
//       username: `user1`,
//       displayName: `User 1`,
//       bio: `this is a dummy user`,
//       sponsorUrl: null,
//       roles: [],
//       avatarUrl: null,
//     },
//     description: "test description",
//     tags: [`Test`, `Dummy`, `Asset`],
//     license: "CC0-1.0",
//     licenseUrl: null,
//     sourceUrl: null,
//     fileHash: "aabcdefghijklmnopqrstuvwxyz1234567890",
//     fileSize: 123456789,
//     status: Status.Private,
//     statusHistory: [{
//       status: Status.Private,
//       timestamp: new Date(),
//       userId: "123456789123456789123456789",
//       reason: "test"
//     }],
//     createdAt: new Date(),
//     updatedAt: new Date(),
//   };