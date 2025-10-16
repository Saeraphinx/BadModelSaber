import z from "zod/v4";
import { AssetFileFormat, License, LinkedAssetLinkType, Status, Tags } from "./DBTypes";

class Asset {
  static async checkIfExists(id: number): Promise<boolean> {
    // Placeholder for actual database check logic
    return true; // Assume the asset exists for this example
  }
}
class User {
  static async checkIfExists(id: string): Promise<boolean> {
    // Placeholder for actual database check logic
    return true; // Assume the user exists for this example
  }
}

export const zAsset = z.object({
  // unique by db
  id: z.number().int().positive(),
  // unique by db
  oldId: z.number().int().nullable(),
  linkedIds: z.array(z.object({
    id: z.number().refine(async (id) => await Asset.checkIfExists(id)),
    linkType: z.enum(LinkedAssetLinkType),
  })),
  type: z.enum(AssetFileFormat),
  uploaderId: z.string().refine(async (id) => await User.checkIfExists(id)),
  collaborators: z.array(z.string()),
  name: z.string().min(1).max(64),
  description: z.string().max(4096),
  license: z.enum(Object.values(License)),
  licenseUrl: z.url().nullable(),
  sourceUrl: z.url().nullable(),
  // unique by db
  fileHash: z.string().min(1).max(64),
  fileSize: z.number().int().positive(),
  status: z.enum(Status),
  statusHistory: z.array(z.object({
    status: z.enum(Status),
    reason: z.string().max(512),
    timestamp: z.date(),
    userId: z.string().refine(async (id) => await User.checkIfExists(id)), // User ID of the person who changed the status
  })),
  tags: z.array(z.enum(Tags)).max(5).default([]),
  createdAt: z.date(),
  updatedAt: z.date(),
  deletedAt: z.date().nullable().optional(),
}).refine(async (data) => {
  if (data.license === 'custom' && !data.licenseUrl) {
    return false; // If license is custom, licenseUrl must be provided
  } else if (data.license !== 'custom' && data.licenseUrl) {
    return false; // If license is not custom, licenseUrl must not be provided
  }
  return true;
}, {
  message: "If license is 'custom', licenseUrl must be provided.",
});