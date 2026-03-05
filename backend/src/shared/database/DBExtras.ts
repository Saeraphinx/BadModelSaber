import { validRange } from "semver";
import z from "zod/v4";

export const dbId = z.int().positive();

export enum PlatformType {
  GitHub = "GitHub",
  KoFi = "Ko-fi",
  Patreon = "Patreon",
}

// #region Asset Enums
// Changes to this enum should be made note of and checked for in translation documents if needed
export enum AssetFileFormat {
  // sabers
  Saber_Wacker = 'saber_wacker',
  Saber_Saber = 'saber_saber',

  Avatar_Avatar = 'avatar_avatar',

  Platform_Plat = 'platform_plat',

  Note_Bloq = 'note_bloq',
  Note_Cyoob = 'note_cyoob',

  Wall_Pixie = 'wall_pixie',
  Wall_Box = 'wall_box',

  HealthBar_Energy = 'health-bar_energy',

  Sound_Ogg = 'sound_ogg',
  Sound_Mp3 = 'sound_mp3',

  Banner_Png = 'banner_png',

  ChromaEnv_JSON = 'chroma-environment_json',
  Camera2Config_JSON = 'camera2-config_json',
  CountersPlusConfig_JSON = 'counters-plus-config_json',
  HSVConfig_JSON = 'hitscorevisualizer-config_json',
}

/*
  Verified & Unverified should both be considered "approved" statuses.
  The difference is that Unverified assets are newly approved assets that haven't been approved (and likely dont need to be) by a moderator yet.
  Verified assets have been explicitly approved by a moderator.
  Pending assets are waiting for initial approval by a moderator. This is for assets that need to be reviewed before being made public, such as asset bundles.
*/
// Changes to this enum should be mirrored in translation documents
export enum Status {
  Private = 'private', // only uploader & collaborators can see
  Pending = 'pending', // pending review by moderators (default for asset bundles)
  Unverified = 'unverified', // approved but not yet verified by mods (default for everything else)
  Verified = 'verified', // approved & verified by mods
  Removed = 'removed', // rejected by moderators
}

export enum License {
  CC0 = "cc0-1.0",
  CC40_BY = "cc4.0-by",
  CC40_BY_SA = "cc4.0-by-sa",
  CC40_BY_ND = "cc4.0-by-nd",
  CC40_BY_NC = "cc4.0-by-nc",
  CC40_BY_NC_SA = "cc4.0-by-nc-sa",
  CC40_BY_NC_ND = "cc4.0-by-nc-nd",
  Custom = "custom"
}

export enum LinkedAssetLinkType {
  Older = 'older', // e.g. a newer version of the asset
  Newer = 'newer', // e.g. an older version of the asset
  AltFormat = 'altFormat', // e.g. a different format of the same asset (e.g. .saber and .wacker)
  Alternate = 'alternate', // e.g. an alternate version of the asset (e.g. a different color scheme)
}

// #endregion Asset Enums

// #region Tags
/*
HOW TO ADD TAGS:
- Add Tag this enum
- copy this file to frontend/backend
  - If removing/editing a tag, make sure to add a migration for it in the database
- Add extra information to tags.ts on the frontend
- If the tag is protected/internal, edit protectedTags in Asset.ts on the backend
*/
export enum Tags {
  // features
  CustomColors = 'CustomColors', // all really
  CustomTrails = 'CustomTrails', //sabers
  CustomBombs = 'CustomBombs', // notes
  CustomArrows = 'CustomArrows', // notes

  AudioLink = 'AudioLink', // sabers
  Reactive = 'Reactive', // sabers/platforms
  Animations = 'Animations', // sabers/platforms
  Sounds = 'Sounds', // sabers/platforms w/ audio

  FBT = 'FBT', // asset
  Cloth = 'Cloth',
  DynamicBones = 'DynamicBones',
  Shaders = 'ShaderReplacement',
  NSFW = 'NSFW',

  // types/genres
  Meme = 'Meme',
  Thin = 'Thin', // sabers
  Large = 'Large', // sabers
  Acc = 'Acc',
  Particles = 'Particles', // sabers
  Sword = 'Sword', // sabers
  Simple = 'Simple', // sabers
  VideoGame = 'VideoGame',
  Anime = 'Anime',
  Pride = 'Pride',
  Pro = 'Pro',
  Halloween = 'Halloween',
  Holiday = 'Holiday',
  Christmas = 'Christmas',

  Underswing = 'Underswing', // hsv
  TimeDependence = 'TimeDependence', // hsv
  Hitsound = 'Hitsound', // sounds
  BadHitsound = 'BadCutHitsound', // sounds
  MenuClick = 'MenuClick', // sounds
  FirstPerson = 'FirstPerson', // camera2
  ThirdPerson = 'ThirdPerson', // camera2

  // protected tags
  Contest = 'Contest',

  // internal tags
  Featured = 'Featured',
}

// #region Alert & Reqeust & User Enums
export enum UserPermissions {
  Mods_Create = "mods_create", // User can create new mods (e.g. sabers, platforms, etc.)
  Mods_ViewAll = "mods_view_all", // User can view all mods, including private ones 
  Mods_EditAll = "mods_edit_all", // User can edit all mods, including those created by other users
  Mods_Approval = "mods_approval", // User can approve/reject pending mods

  Asset_Create = "asset_create", // User can create/upload assets
  Asset_ViewAll = "asset_view_all", // User can view all assets, including private ones
  Asset_EditAll = "asset_edit_all", // User can edit all assets, including private ones
  Asset_Approval = "asset_approval", // User can approve/reject pending assets 
  Asset_InternalTags = "asset_internal_tags", // User can add/remove internal tags (e.g. featured)

  Reports_ViewAll = "reports_view_all", // User can view all reports
  Reports_Manage = "reports_manage", // User can manage (accept/decline) reports, regardless of responseBy

  Users_EditSelf = "users_update_self", // User can update their own profile (e.g. bio, display name, etc.)
  Users_Ban = "users_ban", // User can ban/unban other users
  Users_EditAll = "users_edit_all", // User can edit other users' profiles (e.g. edit bio, etc.)
  Users_EditAllRoles = "users_edit_all_roles", // User can edit all roles of other users

  Administative_Tasks = "administrative_tasks", // User can perform high-level admin tasks

  // cosmetic roles for badges only
  C_Developer = "cos_developer", // User is a developer of the site
  C_Moderator = "cos_moderator", // User is a moderator of the site
  C_Admin = "cos_admin", // User is an admin of the site
  C_BSMG_Staff = "cos_bsmg_staff", // User is a member of the BSMG staff
  C_Modeler = "cos_modeler", // User is a recognized modeler on ModelSaber
  C_System = "cos_system", // User is a system account
}

export enum AlertType {
  Generic = "generic", // Generic alert type, used for non-specific alerts
  ThingVerified = "thing_verified", // Alert when a thing is approved
  ThingRejected = "thing_rejected", // Alert when a thing is rejected
  ThingRemoval = "thing_removal", // Alert when a thing is removed
  RequestAccepted = "request_accepted", // Alert when a request is accepted
  RequestDeclined = "request_declined", // Alert when a request is declined
}

export enum RequestType {
  Credit = "credit", // Request to credit the user for an asset
  Link = "link", // Request to add an asset to linkedIds that the author is not the uploader of
  Report = "report", // Request to report an asset for a specific reason
}
// #endregion Alert Enums

// #region Zod Schemas
export const platformTypeSchema = z.enum(PlatformType)
export type UserPlatform = z.infer<typeof userPlatformSchema>;
export const userPlatformSchema = z.object({
  platform: platformTypeSchema,
  url: z.string()
})

export type AssetPublicAPIv2 = z.infer<typeof assetPublicAPIv2Schema>;
export const assetPublicAPIv2Schema = z.object({
  tags: z.array(z.string()),
  type: z.string(),
  name: z.string(),
  author: z.string(),
  thumbnail: z.string(),
  id: z.number(),
  hash: z.string(),
  bsaber: z.string(),
  status: z.string(),
  discordid: z.string(),
  discord: z.string(),
  variationid: z.number().nullable(),
  platform: z.string(),
  download: z.string(),
  install_link: z.string(),
  date: z.string()
})

export type AssetPublicAPIv1 = z.infer<typeof assetPublicAPIv1Schema>;
export const assetPublicAPIv1Schema = assetPublicAPIv2Schema.pick({
  tags: true,
  type: true,
  name: true,
  author: true,
  hash: true,
  bsaber: true,
  download: true,
  install_link: true,
  date: true
}).extend({
  image: z.string()
});
// #endregion
// #region Asset Enums
export const assetFileFormatSchema = z.enum(AssetFileFormat)
export const statusSchema = z.enum(Status)
export const licenseSchema = z.enum(License)
export type StatusHistory = z.infer<typeof statusHistorySchema>;
export const statusHistorySchema = z.object({
  status: statusSchema,
  reason: z.string(),
  timestamp: z.preprocess((input) => {
    if (typeof input === 'string') {
      const date = new Date(input);
      if (isNaN(date.getTime())) {
        return undefined; // Will fail .date() validation
      }
      return date;
    }
    return input;
  }, z.date()),
  userId: dbId
})
export const linkedAssetLinkTypeSchema = z.enum(LinkedAssetLinkType)
export const tagsSchema = z.enum(Tags)

// #endregion Asset Enums
// #region Alert & Reqeust & User Enums
export const userPermissionsSchema = z.enum(UserPermissions)
export const alertTypeSchema = z.enum(AlertType)
export const requestTypeSchema = z.enum(RequestType)

export type RequestMessage = z.infer<typeof requestMessageSchema>;
export const requestMessageSchema = z.object({
  userId: dbId,
  message: z.string(),
  timestamp: z.preprocess((input) => {
    if (typeof input === 'string') {
      const date = new Date(input);
      if (isNaN(date.getTime())) {
        return undefined; // Will fail .date() validation
      }
      return date;
    }
    return input;
  }, z.date()),
})


// #endregion
export type LinkedAsset = z.infer<typeof linkedAssetSchema>;
export const linkedAssetSchema = z.object({
  id: dbId,
  linkType: linkedAssetLinkTypeSchema
})

// # region Enums
export enum WebhookLogType {
  NewlyVerified = "newly_verified",
  NewlyUnverified = "newly_unverified",
  NewThing = "new_thing", // e.g. new asset, new project
  NewSubThing = "new_sub_thing", // e.g. new version of a project

  Text_StatusUpdate = "text_status_update",
  Text_Edited = "text_edited",
  Text_Linked = "text_linked",
}

// #endregion
export const ContentHashSchema = z.object({
  path: z.string(),
  hash: z.string(),
});
export type ContentHash = z.infer<typeof ContentHashSchema>;

export const DependencySchema = z.object({
  pId: dbId, // mod/project id
  sv: z.string().refine((str) => {
    // validate semver range
    if (validRange(str)) {
      return true;
    } else {
      return false;
    }
  }), // semver range e.g. "^1.0.0"
});
export type Dependency = z.infer<typeof DependencySchema>;

// #region API v1 Schemas
// seperate type to avoid circular reference issues with zod
export type ModApiV1 = {
  name: string,
  version: string,
  gameVersion: string,
  authorId: string,
  author?: {
    _id: string,
    username: string,
    lastLogin: string,
  },
  uploadDate: string,
  updatedDate: string,
  status: `pending` | `approved` | `declined` | `inactive`,
  description: string,
  link: string,
  category: string,
  required: boolean,
  downloads: {
    type: string,
    url: string,
    hashMd5: {
      hash: string,
      file: string,
    }[],
  }[],
  dependencies: ModApiV1[] | string[],
  _id: string,
}

const ModApiV1Schema: z.ZodType<ModApiV1> = z.lazy(() => z.object({
  name: z.string(),
  version: z.string(),
  gameVersion: z.string(),
  authorId: z.string(),
  author: z.object({
    _id: z.string(),
    username: z.string(),
    lastLogin: z.string()
  }).optional(),
  uploadDate: z.string(),
  updatedDate: z.string(),
  status: z.enum([`pending`, `approved`, `declined`, `inactive`]),
  description: z.string(),
  link: z.string(),
  category: z.string(),
  required: z.boolean(),
  downloads: z.array(z.object({
    type: z.string(),
    url: z.string(),
    hashMd5: z.array(z.object({
      hash: z.string(),
      file: z.string()
    }))
  })),
  dependencies: z.array(ModApiV1Schema).or(z.array(z.string())),
  _id: z.string(),
}));
// #endregion
// #region API v2 Schemas
export const UserApiV2Schema = z.object({
  id: z.number().int().positive(),
  username: z.string(),
  githubId: z.number().nullable(),
  sponsorUrl: z.string().nullable(),
  displayName: z.string(),
  roles: z.object({ // do not allow roles to be sent when using v2 of the API
    sitewide: z.array(z.enum([])),
    perGame: z.record(z.string(), z.array(z.enum([]))),
  }),
  bio: z.string(),
  createdAt: z.date(),
  updatedAt: z.date(),
});
export type UserPublicApiV2 = z.infer<typeof UserApiV2Schema>;

export const GameVersionApiv2Schema = z.object({
  id: z.number().int().positive(),
  gameName: z.string(),
  version: z.string(),
  defaultVersion: z.boolean(),
  createdAt: z.date(),
  updatedAt: z.date(),
});
export type GameVersionApiV2 = z.infer<typeof GameVersionApiv2Schema>;

export const ModApiv2Schema = z.object({
  id: z.number().int().positive(),
  name: z.string(),
  summary: z.string(),
  description: z.string(),
  gameName: z.string(),
  category: z.string(),
  authors: z.array(UserApiV2Schema),
  status: z.enum([`private`, `removed`, `pending`, `unverified`, `verified`]),
  iconFileName: z.string(),
  gitUrl: z.string(),
  lastApprovedById: z.number().nullable(),
  lastUpdatedById: z.number(),
  statusHistory: z.array(z.object({
    status: z.string(),
    reason: z.string(),
    userId: z.number(),
    setAt: z.iso.datetime()
  })),
  createdAt: z.date(),
  updatedAt: z.date()
})
export type ModApiv2 = z.infer<typeof ModApiv2Schema>;

export const ModVersionsApiv2Schema = z.object({
  id: z.number(),
  modId: z.number(),
  modVersion: z.string(), // semver
  author: UserApiV2Schema,
  platform: z.string(),
  zipHash: z.string(),
  contentHashes: z.array(z.object({
    path: z.string(),
    hash: z.string()
  })),
  status: z.enum([`private`, `removed`, `pending`, `unverified`, `verified`]),
  dependencies: z.array(z.number()),
  supportedGameVersions: z.array(GameVersionApiv2Schema),
  downloadCount: z.number(),
  statusHistory: z.array(z.object({
    status: z.string(),
    reason: z.string(),
    userId: z.number(),
    setAt: z.date()
  })),
  lastUpdatedById: z.number(),
  lastApprovedById: z.number().nullable(),
  fileSize: z.number(),
  createdAt: z.date(),
  updatedAt: z.date()
})
export type ModVersionsApiv2 = z.infer<typeof ModVersionsApiv2Schema>;
// #endregion
// #region API v3 Schemas
let GameVersionApiV3Schema = z.object({
  id: z.number().int().positive(),
  gameName: z.string(),
  version: z.string(),
});
export type GameVersionApiV3 = z.infer<typeof GameVersionApiV3Schema>;

export type UserApiV3 = z.infer<typeof userApiV3Schema>;
export const userApiV3Schema = z.object({
  id: dbId,
  username: z.string(),
  displayName: z.string(),
  bio: z.string().nullable(),
  userPlatforms: z.array(userPlatformSchema).nullable(),
  avatarUrl: z.string(),
  permissions: z.object({
    perGame: z.record(z.string(), z.array(z.enum(UserPermissions))),
    sitewide: z.array(z.enum(UserPermissions))
  }),
})

export type AlertPublicApiv3 = z.infer<typeof alertPublicApiv3Schema>;
export const alertPublicApiv3Schema = z.object({
  id: dbId,
  type: alertTypeSchema,
  assetId: dbId.nullable(),
  requestId: dbId.nullable(),
  header: z.string(),
  message: z.string(),
  read: z.boolean(),
  createdAt: z.date(),
  updatedAt: z.date()
})

export const ProjectApiV3Schema = z.object({
  id: dbId,
  name: z.string(),
  summary: z.string(),
  description: z.string(),
  category: z.string(),
  authors: z.array(userApiV3Schema),
  gameName: z.string(),
  status: z.enum(Status),
  iconFileName: z.string(),
  gitUrl: z.string(),
  lastApprovedById: dbId.nullable(),
  lastUpdatedById: dbId,
  statusHistory: z.array(statusHistorySchema),
  translation: z.object({
    name: z.string().nullable(),
    summary: z.string().nullable(),
    description: z.string().nullable(),
  }).nullable(),
  createdAt: z.date(),
  updatedAt: z.date(),
});
export type ProjectApiV3 = z.infer<typeof ProjectApiV3Schema>;

export const VersionApiV3Schema = z.object({
  id: dbId,
  projectId: dbId,
  uploaderId: dbId,
  semver: z.string(),
  supportedGameVersions: z.array(GameVersionApiV3Schema),
  status: z.enum(Status),
  dependencies: z.array(DependencySchema),
  platform: z.string(),
  zipHash: z.string(),
  contentHashes: z.array(ContentHashSchema),
  fileSize: z.number(),
  createdAt: z.date(),
  updatedAt: z.date(),
});
export type VersionApiV3 = z.infer<typeof VersionApiV3Schema>;

export type AssetApiV3 = z.infer<typeof assetApiV3Schema>;
export const assetApiV3Schema = z.object({
  id: dbId,
  oldId: z.number().nullable(),
  linkedIds: z.array(linkedAssetSchema),
  type: assetFileFormatSchema,
  uploaderId: dbId,
  uploader: userApiV3Schema.nullable(),
  icons: z.array(z.string()),
  name: z.string(),
  description: z.string(),
  license: z.string(),
  licenseUrl: z.string().nullable(),
  sourceUrl: z.string().nullable(),
  fileHash: z.string(),
  fileSize: z.number(),
  fileSafeName: z.string(),
  downloadUrl: z.url(),
  status: statusSchema,
  statusHistory: z.array(statusHistorySchema),
  collaborators: z.array(dbId),
  tags: z.array(z.string()),
  createdAt: z.date(),
  updatedAt: z.date()
})

export type AssetRequestApiV3 = z.infer<typeof assetRequestApiV3Schema>;
export const assetRequestApiV3Schema = z.object({
  id: dbId,
  refrencedAssetId: dbId,
  refrencedAsset: assetApiV3Schema.nullable(),
  requesterId: dbId,
  requester: userApiV3Schema.nullable(),
  requestResponseBy: dbId.nullable(),
  requestType: requestTypeSchema,
  accepted: z.boolean().nullable(),
  messages: z.array(requestMessageSchema),
  resolvedBy: z.string().nullable(),
  createdAt: z.date(),
  updatedAt: z.date()
})
// #endregion
