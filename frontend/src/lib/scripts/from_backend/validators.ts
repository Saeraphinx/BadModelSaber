import z from "zod";
import { AssetFileFormat, dbId, License, LinkedAssetLinkType, RenderingModes, Status, statusHistorySchema, Tags } from "./DBExtras";
import type { AssetInfer } from "../../../../../backend/src/shared/Database";
import type { ProjectInfer } from "../../../../../backend/src/shared/Database";

class Asset {
  public static readonly invalidFileNameChars = /[<>:"/\\|?*\x00-\x1F]/gi;
  public static readonly invalidFileNameWin = /^(CON|PRN|AUX|NUL|COM[1-9]|LPT[1-9])(\..*)?$/gi;
  public static async checkIfExists(id: number): Promise<boolean> {
    return true;
  }
}

class User {
  public static async checkIfExists(id: number): Promise<boolean> {
    return true;
  }
}

export const zAsset = z.object({
  // unique by db
  id: dbId,
  // unique by db
  oldId: z.number().int().nullable(),
  linkedIds: z.array(z.object({
    id: dbId.refine(async (id) => await Asset.checkIfExists(id)),
    linkType: z.enum(LinkedAssetLinkType),
  })),
  type: z.enum(AssetFileFormat),
  uploaderId: dbId.refine(async (id) => await User.checkIfExists(id)),
  collaboratorIds: z.array(dbId),
  name: z.string().min(1).max(64),
  description: z.string().max(4096),
  license: z.enum(Object.values(License)),
  licenseUrl: z.url().nullable(),
  sourceUrl: z.url().nullable(),
  fileSafeName: z.string().min(1).max(128).refine(str => !Asset.invalidFileNameChars.test(str), `Invalid charecters`).refine(str => !Asset.invalidFileNameWin.test(str), "File name is a reserved Windows name"),
  // unique by db
  fileHash: z.string().min(1).max(64),
  fileSize: z.number().int().positive(),
  iconNames: z.array(z.string()).max(5),
  status: z.enum(Status),
  statusHistory: z.array(z.object({
    status: z.enum(Status),
    reason: z.string().max(512),
    timestamp: z.iso.datetime(),
    userId: dbId.refine(async (id) => await User.checkIfExists(id)), // User ID of the person who changed the status
  })),
  tags: z.array(z.enum(Tags)).default([]),
  gameName: z.string().min(1).max(64),
  renderingMethod: z.enum(RenderingModes).nullable(),
  createdAt: z.date(),
  updatedAt: z.date(),
  deletedAt: z.date().nullable(),
}) satisfies z.ZodType<AssetInfer>;

export const zProject = z.object({
  id: dbId,
  name: z.string().max(128),
  nameId: z.string().max(128),
  summary: z.string().max(256),
  description: z.string().max(8192),
  gameName: z.string(),
  category: z.string(),
  authorIds: z.array(dbId).min(1),
  status: z.enum(Status),
  iconFileName: z.string(),
  gitUrl: z.url(),
  lastApprovedById: dbId.nullable(),
  lastUpdatedById: dbId,
  collaboratorIds: z.array(dbId),
  statusHistory: z.array(statusHistorySchema),
  createdAt: z.date(),
  updatedAt: z.date(),
  deletedAt: z.date().nullable(),
}) satisfies z.ZodType<ProjectInfer>;