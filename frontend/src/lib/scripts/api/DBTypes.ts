import z from "zod/v4";

export enum SponsorType {
  GitHub = "github",
  KoFi = "ko-fi",
  Patreon = "patreon",
}

// #region Asset Enums
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
// #endregion Asset Enums

// #region Alert & Reqeust & User Enums
export enum UserPermissions {
  // actual permissions
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

  Users_Ban = "users_ban", // User can ban/unban other users
  Users_Edit = "users_edit", // User can edit other users' profiles (e.g. add/remove roles, edit bio, etc.)

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
  AssetVerified = "asset_verified", // Alert when an asset is approved
  AssetRejected = "asset_rejected", // Alert when an asset is rejected
  AssetRemoval = "asset_removal", // Alert when an asset is removed
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
export const sponsorTypeSchema = z.enum(SponsorType)
export type SponsorUrl = z.infer<typeof sponsorUrlSchema>;
export const sponsorUrlSchema = z.object({
  platform: sponsorTypeSchema,
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
  userId: z.number()
})
export const linkedAssetLinkTypeSchema = z.enum(LinkedAssetLinkType)
export const tagsSchema = z.enum(Tags)

// #endregion Asset Enums
// #region Alert & Reqeust & User Enums
export const userPermissionsSchema = z.enum(UserPermissions)
export const alertTypeSchema = z.enum(AlertType)
export const requestTypeSchema = z.enum(RequestType)

// #endregion Alert Enums
export type RequestMessage = z.infer<typeof requestMessageSchema>;
export const requestMessageSchema = z.object({
  userId: z.number(),
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

export type UserPublicAPIv3 = z.infer<typeof userPublicAPIv3Schema>;
export const userPublicAPIv3Schema = z.object({
  id: z.string(),
  username: z.string(),
  displayName: z.string(),
  bio: z.string().nullable(),
  sponsorUrl: z.array(sponsorUrlSchema).nullable(),
  avatarUrl: z.string(),
  roles: z.array(userPermissionsSchema)
})

export type AlertPublicAPIv3 = z.infer<typeof alertPublicAPIv3Schema>;
export const alertPublicAPIv3Schema = z.object({
  id: z.number(),
  type: alertTypeSchema,
  assetId: z.number().nullable(),
  requestId: z.number().nullable(),
  header: z.string(),
  message: z.string(),
  read: z.boolean(),
  createdAt: z.date(),
  updatedAt: z.date()
})

export type LinkedAsset = z.infer<typeof linkedAssetSchema>;
export const linkedAssetSchema = z.object({
  id: z.number(),
  linkType: linkedAssetLinkTypeSchema
})

export type AssetPublicAPIv3 = z.infer<typeof assetPublicAPIv3Schema>;
export const assetPublicAPIv3Schema = z.object({
  id: z.number(),
  oldId: z.number().nullable(),
  linkedIds: z.array(linkedAssetSchema),
  type: assetFileFormatSchema,
  uploaderId: z.string(),
  uploader: userPublicAPIv3Schema.nullable(),
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
  collaborators: z.array(z.string()),
  tags: z.array(z.string()),
  createdAt: z.date(),
  updatedAt: z.date()
})

export type AssetRequestPublicAPIv3 = z.infer<typeof assetRequestPublicAPIv3Schema>;
export const assetRequestPublicAPIv3Schema = z.object({
  id: z.number(),
  refrencedAssetId: z.number(),
  refrencedAsset: assetPublicAPIv3Schema.nullable(),
  requesterId: z.string(),
  requester: userPublicAPIv3Schema.nullable(),
  requestResponseBy: z.string().nullable(),
  requestType: requestTypeSchema,
  accepted: z.boolean().nullable(),
  messages: z.array(requestMessageSchema),
  resolvedBy: z.string().nullable(),
  createdAt: z.date(),
  updatedAt: z.date()
})