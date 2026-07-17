import { validRange } from "semver";
import z from "zod/v4";

export type ElementType<T> = T extends (infer U)[] ? U : T;

export const dbId = z.int().positive();

export enum PlatformType {
  GitHub = "GitHub",
  KoFi = "Ko-fi",
  Patreon = "Patreon",
}

export const availableLocales: {
  code: string;
  name: string;
  secret: boolean; // whether this is a secret translation that should not be advertised as available on the frontend
  frontend: boolean; // whether this translation is used on the frontend
  backend: boolean; // whether this translation is used in mod/asset translations (e.g. backend things) or just text translations (e.g. frontend things)
}[] = [
  {
    code: "en",
    name: "English",
    secret: false,
    backend: false, // English is the default language and is used as a fallback for missing translations, so it should not be marked as a backend translation
    frontend: true,
  },
  {
    code: "ja",
    name: "日本語", // Japanese
    secret: false,
    backend: true,
    frontend: false,
  },
  {
    code: "qab",
    name: "OwO",
    secret: true,
    frontend: true,
    backend: false,
  },
  {
    code: "qaa",
    name: "Translation Keys",
    secret: true,
    frontend: true,
    backend: false,
  }
]

export const availableFrontendLocaleCodes = availableLocales.filter(l => l.frontend).map(l => l.code);
export const availableBackendLocaleCodes = availableLocales.filter(l => l.backend).map(l => l.code);

// #region Asset Enums
// Changes to this enum should be made note of and checked for in translation documents if needed
export enum AssetFileFormat {
  // sabers
  Saber_Whacker = 'saber_whacker',
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
  Queue = 'queue', // pending review by moderators (default for asset bundles)
  Unverified = 'unverified', // approved but not yet verified by mods (default for everything else)
  Testing = 'testing', // approved but needs to be tested by testers before being verified
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
  AltFormat = 'altFormat', // e.g. a different format of the same asset (e.g. .saber and .whacker)
  Alternate = 'alternate', // e.g. an alternate version of the asset (e.g. a different color scheme)
}

export const AssetTypesWithRenderingMethod = [
  AssetFileFormat.Saber_Whacker,
  AssetFileFormat.Saber_Saber,
  AssetFileFormat.Platform_Plat,
  AssetFileFormat.Note_Bloq,
  AssetFileFormat.Note_Cyoob,
  AssetFileFormat.Wall_Pixie,
  AssetFileFormat.Wall_Box,
  AssetFileFormat.Avatar_Avatar,
]
export enum RenderingModes {
  BIRP_SinglePass = "birp_sp",
  BIRP_SinglePassInstanced = "birp_spi",
  URP_Unity6 = "urp_u6",
  Unknown = "unknown",
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
  Mods_TranslateAll = "mods_translate_all", // User can translate all mods, including those created by other users
  Mods_UploadAll = "mods_upload_all", // User can upload new versions for all mods, including those created by other users
  Mods_Approval = "mods_approval", // User can approve/reject pending mods

  Asset_Create = "asset_create", // User can create/upload assets
  Asset_ViewAll = "asset_view_all", // User can view all assets, including private ones
  Asset_EditAll = "asset_edit_all", // User can edit all assets, including private ones
  Asset_Approval = "asset_approval", // User can approve/reject pending assets 
  Asset_InternalTags = "asset_internal_tags", // User can add/remove internal tags (e.g. featured)

  Requests_ViewAssets = "requests_view_assets", // User can view asset requests
  Requests_ViewMods = "requests_view_mods", // User can view mod requests
  Requests_ViewUsers = "requests_view_users", // User can view user requests
  Requests_ViewAll = "requests_view_all", // User can view all requests
  Requests_ManageAssets = "requests_manage_assets", // User can manage (accept/decline) asset requests
  Requests_ManageMods = "requests_manage_mods", // User can manage (accept/decline) mod requests
  Requests_ManageUsers = "requests_manage_users", // User can manage (accept/decline) user requests
  Requests_ManageAll = "requests_manage_all", // User can manage (accept/decline) requests, regardless of responseBy

  Users_EditSelf = "users_update_self", // User can update their own profile (e.g. bio, display name, etc.)
  Users_Ban = "users_ban", // User can ban/unban other users
  Users_EditAll = "users_edit_all", // User can edit other users' profiles (e.g. edit bio, etc.)
  Users_EditAllRoles = "users_edit_all_roles", // User can edit all roles of other users. basically allows all permissions

  Game_ViewExtras = "game_view_extras", // User can view extra details about games (e.g. webhooks)
  Game_Create = "game_create", // User can create new games
  Game_Edit = "game_edit", // User can edit game details (e.g. display name, categories, platforms, etc.)
  Game_EditVersions = "game_edit_versions", // User can create/edit game versions

  Administrative_Tasks = "administrative_tasks", // User can perform high-level admin tasks

  Secret_Features = "secret_features", // User can access secret features that enabled by inputting a specific code.

  // cosmetic roles for badges only
  C_Banned = "cos_banned", // User is banned and should not be able to do anything
  C_Developer = "cos_developer", // User is a developer of the site
  C_Moderator = "cos_moderator", // User is a moderator of the site
  C_Admin = "cos_admin", // User is an admin of the site
  C_BSMG_Staff = "cos_bsmg_staff", // User is a member of the BSMG staff
  C_Modeler = "cos_modeler", // User is a recognized modeler on ModelSaber
  C_Modder = "cos_modder", // User is a recognized modeler on ModelSaber
  C_System = "cos_system", // User is a system account
}

export enum AlertType {
  Generic = "generic", // Generic alert type, used for non-specific alerts
  ThingGood = "thing_good", //
  ThingInfo = "thing_info", //
  ThingWarn = "thing_warn", // 
  ThingBad = "thing_bad", //
  RequestAccepted = "request_accepted", // Alert when a request is accepted
  RequestDeclined = "request_declined", // Alert when a request is declined
}

export enum RequestType {
  Asset_Credit = "asset_credit", // Request to credit the user for an asset
  Asset_Link = "asset_link", // Request to add an asset to linkedIds that the author is not the uploader of
  Asset_Report = "asset_report", // Request to report an asset for a specific reason
  Project_Report = "project_report", // Request to report a project for a specific reason
  Version_Report = "version_report", // Request to report a version for a specific reason
  User_Report = "user_report", // Request to report a user for a specific reason
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
  status: z.string(),
  reason: z.string(),
  timestamp: z.iso.datetime(),
  userId: dbId
})
export const linkedAssetLinkTypeSchema = z.enum(LinkedAssetLinkType)
export const tagsSchema = z.enum(Tags)

// #endregion Asset Enums
// #region Alert & Request & User Enums
export const userPermissionsSchema = z.enum(UserPermissions)
export const alertTypeSchema = z.enum(AlertType)
export const requestTypeSchema = z.enum(RequestType)

export type RequestMessage = z.infer<typeof requestMessageSchema>;
export const requestMessageSchema = z.object({
  userId: dbId,
  message: z.string(),
  timestamp: z.iso.datetime(),
})


// #endregion
export type LinkedAsset = z.infer<typeof linkedAssetSchema>;
export const linkedAssetSchema = z.object({
  id: dbId,
  linkType: linkedAssetLinkTypeSchema
})

// # region Enums
export enum WebhookLogType {
  FirstVerificationAsset = "newly_verified_asset",
  FirstUnverificationAsset = "newly_unverified_asset",
  FirstVerificationProject = "newly_verified_project",
  FirstVerificationVersion = "newly_verified_version",
  FirstUnverificationVersion = "newly_unverified_version",
  AddedToQueueAsset = "added_to_queue_asset",
  AddedToQueueVersion = "added_to_queue_version",
  AddedToTestingVersion = "added_to_testing_version",
  NewThing = "new_thing", // e.g. new asset, new project
  NewSubThing = "new_sub_thing", // e.g. new version of a project
  NewReport = "new_report", // e.g. new report for a project, version, asset, or user

  StatusUpdate = "status_update",

  Text_TranslationOutOfDate = "text_translation_out_of_date",
  Text_StatusUpdate = "text_status_update",
  Text_Edited = "text_edited",
  Text_Linked = "text_linked",
  Text_NewReportMessage = "new_report_message", // new message in an existing report
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
export type GameVersionApiV3_full = GameVersionApiV3 & {
  defaultVersion: boolean,
  linkedVersionIds: number[],
  createdAt: Date,
  updatedAt: Date,
}

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

export type AlertApiV3 = z.infer<typeof alertApiV3Schema>;
export const alertApiV3Schema = z.object({
  id: dbId,
  type: alertTypeSchema,
  assetId: dbId.nullable(),
  projectId: dbId.nullable(),
  versionId: dbId.nullable(),
  requestId: dbId.nullable(),
  header: z.string(),
  message: z.string(),
  read: z.boolean(),
  createdAt: z.date(),
  updatedAt: z.date()
})

export const projectApiV3Schema = z.object({
  id: dbId,
  name: z.string(),
  nameId: z.string(),
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
export type ProjectApiV3 = z.infer<typeof projectApiV3Schema>;

export const versionApiV3Schema = z.object({
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
  statusHistory: z.array(statusHistorySchema),
  baseFileName: z.string(),
  downloadUrl: z.url(),
  fileSize: z.number(),
  createdAt: z.date(),
  updatedAt: z.date(),
});
export type VersionApiV3 = z.infer<typeof versionApiV3Schema>;

export type AssetApiV3 = z.infer<typeof assetApiV3Schema>;
export const assetApiV3Schema = z.object({
  id: dbId,
  oldId: z.number().nullable(),
  gameName: z.string(),
  linkedIds: z.array(linkedAssetSchema),
  type: assetFileFormatSchema,
  renderingMethod: z.enum(RenderingModes).nullable(),
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
  downloadUrl: z.url(),
  status: statusSchema,
  statusHistory: z.array(statusHistorySchema),
  collaborators: z.array(dbId),
  tags: z.array(z.string()),
  createdAt: z.date(),
  updatedAt: z.date()
})

export type ThingRequestApiV3 = z.infer<typeof thingRequestApiV3Schema>;
export const thingRequestApiV3Schema = z.object({
  id: dbId,
  refrencedThingId: dbId,
  refrencedThing: z.union([assetApiV3Schema, userApiV3Schema, projectApiV3Schema, versionApiV3Schema]).nullable(),
  refrencedGameName: z.string().nullable(),
  requesterId: dbId,
  requester: userApiV3Schema.nullable(),
  requestResponseBy: dbId.nullable(),
  requestType: requestTypeSchema,
  accepted: z.boolean().nullable(),
  messages: z.array(requestMessageSchema),
  resolvedBy: dbId.nullable(),
  createdAt: z.date(),
  updatedAt: z.date()
})
// #endregion
