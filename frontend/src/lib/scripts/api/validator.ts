import z from "zod/v4";
import { AssetFileFormat, License, LinkedAssetLinkType, Status, Tags } from "./DBTypes";
import type { AssetValidatorType } from "../../../../../backend/src/shared/Database"

class Asset {
  public static readonly invalidFileNameChars = /[^<>:"/\\|?*\x00-\x1F]/gi;
  public static readonly invalidFileNameWin = /^(CON|PRN|AUX|NUL|COM[1-9]|LPT[1-9])(\..*)?$/gi;
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
