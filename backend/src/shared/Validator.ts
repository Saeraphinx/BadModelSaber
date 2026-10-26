import { AssetFileFormat, Status, Tags } from "./database/DBExtras.ts";
import jszip from "jszip";
import { parseErrorMessage } from "./Tools.ts";
import z from "zod/v4";
import { EnvConfig } from "./EnvConfig.ts";

export class Validator {
  public static async validateThumbnail(file: File) {
    let isAcceptableImage =
      ((file.type === `image/png` && file.name.endsWith(`.png`) && await Validator.isPng(file)) ||
        (file.type === `image/jpeg` && file.name.endsWith(`.jpg`) && await Validator.isJpg(file)) ||
        (file.type === `image/gif` && file.name.endsWith(`.gif`) && await Validator.isGif(file)) ||
        (file.type === `image/webp` && file.name.endsWith(`.webp`) && await Validator.isWebp(file)));

    return isAcceptableImage && (file.size <= 8 * 1024 * 1024 || EnvConfig.isDevMode); // 8MB limit
  }

  public static validateAssetFile(file: File, type: AssetFileFormat): boolean {
    let typeFileExtension = type.split(`_`)[1].toLowerCase();
    // removed mime type check since it doesn't seem to be accurate
    switch (type) {
      // PC assets
      case AssetFileFormat.Saber_Saber:
      case AssetFileFormat.Avatar_Avatar:
      case AssetFileFormat.Platform_Plat:
      case AssetFileFormat.Note_Bloq:
      case AssetFileFormat.Wall_Pixie:
      case AssetFileFormat.HealthBar_Energy:
        return /*file.type === `application/octet-stream` && */ file.name.endsWith(`.${typeFileExtension}`);
      // Quest/PC assets
      case AssetFileFormat.Saber_Whacker:
      case AssetFileFormat.Note_Cyoob:
      case AssetFileFormat.Wall_Box:
        return /*(file.type === `application/zip` || file.type === `application/x-zip-compressed` || file.type === `application/octet-stream`) &&*/ file.name.endsWith(`.${typeFileExtension}`);
      // Sound assets
      case AssetFileFormat.Sound_Ogg:
        return /* file.type === `audio/ogg` && */ file.name.endsWith(`.${typeFileExtension}`);
      case AssetFileFormat.Sound_Mp3:
        return /* file.type === `audio/mpeg` && */ file.name.endsWith(`.${typeFileExtension}`);
      // Banner assets
      case AssetFileFormat.Banner_Png:
        return/*  file.type === `image/png` && */ file.name.endsWith(`.${typeFileExtension}`);
      // JSON assets
      case AssetFileFormat.ChromaEnv_DAT:
      case AssetFileFormat.CountersPlusConfig_JSON:
      case AssetFileFormat.HSVConfig_JSON:
      case AssetFileFormat.Camera2Config_JSON:
        return /* file.type === `application/json` && */ file.name.endsWith(`.${typeFileExtension}`);
      default:
        return false; // Invalid asset type
    }
  }

  public static async validateAssetFileData(file: File, type: AssetFileFormat): Promise<{ valid: boolean; reason?: string; }> {
    switch (type) {
      // Unity asset format files
      case AssetFileFormat.Saber_Saber:
      case AssetFileFormat.Avatar_Avatar:
      case AssetFileFormat.Platform_Plat:
      case AssetFileFormat.Note_Bloq:
      case AssetFileFormat.Wall_Pixie:
      case AssetFileFormat.HealthBar_Energy:
        // check that the first 6 bytes match the Unity asset bundle file signature "UnityFS"
        if (file.size > 6 && new Uint8Array(await file.slice(0, 6).arrayBuffer()).every((byte, index) => byte === "UnityFS".charCodeAt(index))) {
          return { valid: true };
        } else {
          return { valid: false, reason: "Invalid Unity asset bundle file." };
        }
      // Zip files
      case AssetFileFormat.Saber_Whacker:
      case AssetFileFormat.Note_Cyoob:
      case AssetFileFormat.Wall_Box:
        // open the file as a zip and check the manifest file exists
        try {
          const zip = await jszip.loadAsync(await file.arrayBuffer());
          let manifest = zip.file("package.json");
          if (!manifest) {
            return { valid: false, reason: `Missing package.json` }; // package.json not found in zip folder
          }
          let result = await manifest.async("string").then((data) => {
            let parsedData = z.looseObject({
              androidFileName: z.string(),
              pcFileName: z.string(),
              descriptor: z.object({
                objectName: z.string(),
                author: z.string(),
                description: z.string(),
                coverImage: z.string()
              }),
            }).safeParse(JSON.parse(data));
            if (!parsedData.success) {
              return parseErrorMessage(parsedData.error); // manifest.json invalid
            } else {
              return true; // manifest.json valid
            }
          });
          if (result) {
            return { valid: true };
          } else {
            return { valid: false, reason: `${result}` }; // manifest.json invalid
          }
        } catch {
          return { valid: false, reason: "Invalid file." };
        }
      case AssetFileFormat.Sound_Ogg:
        if (!(await Validator.startsWith(file, [0x4F, 0x67, 0x67, 0x53]))) {
          return { valid: false, reason: "Invalid OGG file." };
        }
        return { valid: true };
      case AssetFileFormat.Sound_Mp3:
        if (!(await Validator.isMp3(file))) {
          return { valid: false, reason: "Invalid MP3 file." };
        }
        return { valid: true };
      case AssetFileFormat.Banner_Png:
        if (!(await Validator.isPng(file))) {
          return { valid: false, reason: "Invalid PNG file." };
        }
        return { valid: true };
      case AssetFileFormat.ChromaEnv_DAT:
      case AssetFileFormat.CountersPlusConfig_JSON:
      case AssetFileFormat.HSVConfig_JSON:
      case AssetFileFormat.Camera2Config_JSON:
        //check size is below 5mb
        if (file.size > 5 * 1024 * 1024) return { valid: false, reason: "File too large." };
        try {
          const data = JSON.parse(await file.text());
          if (!data) return { valid: false };
          if (typeof data !== "object") return { valid: false };

          let result = null;
          if (type === AssetFileFormat.CountersPlusConfig_JSON) {
            result = CountersPlusSchema.safeParse(data);
          } else if (type === AssetFileFormat.HSVConfig_JSON) {
            result = HitScoreVisualizerSchema.safeParse(data);
          } else if (type === AssetFileFormat.Camera2Config_JSON) {
            return { valid: true };
          } else {
            result = ChromaUserEnvironmentSchema.safeParse(data)
          }

          if (result && !result.success) return { valid: false, reason: result.error?.message };
          if (!result) return { valid: false };

          return { valid: true };
          
        } catch (e) {
          return { valid: false, reason: "Invalid JSON." };
        }
      default:
        return { valid: false, reason: `File format not supported.` }; // No additional validation for other types

    }
  }

  private static async startsWith(file: File, signature: number[], offset = 0): Promise<boolean> {
    if (file.size < offset + signature.length) return false;
    const bytes = new Uint8Array(await file.slice(offset, offset + signature.length).arrayBuffer());
    return signature.every((b, i) => bytes[i] === b);
  }

  private static async isMp3(file: File): Promise<boolean> {
    if (file.size < 3) return false;
    // "ID3" tag header
    if (await Validator.startsWith(file, [0x49, 0x44, 0x33])) return true;
    // Raw MPEG frame sync: 11 set bits (0xFF, then 0b111xxxxx)
    const head = new Uint8Array(await file.slice(0, 2).arrayBuffer());
    return head[0] === 0xFF && (head[1] & 0xE0) === 0xE0;
  }

  private static async isPng(file: File): Promise<boolean> {
    return Validator.startsWith(file, [0x89, 0x50, 0x4E, 0x47]);
  }

  private static async isJpg(file: File): Promise<boolean> {
    return Validator.startsWith(file, [0xFF, 0xD8, 0xFF]);
  }

  private static async isGif(file: File): Promise<boolean> {
    return Validator.startsWith(file, [0x47, 0x49, 0x46, 0x38]);
  }

  private static async isWebp(file: File): Promise<boolean> {
    return Validator.startsWith(file, [0x52, 0x49, 0x46, 0x46]);
  }
}

//#region HitScoreVisualizer
export const HitScoreVisualizerJudgementSchema = z.object({
  threshold: z.number(),
  text: z.string(),
  color: z.array(z.number())
})
export const HitScoreVisualizerSchema = z.object({
  majorVersion: z.number(),
  minorVersion: z.number(),
  patchVersion: z.number(),
  displayMode: z.string(),
  fixedPosition: z.null(),
  targetPositionOffset: z.null(),
  timeDependencyDecimalPrecision: z.number(),
  timeDependencyDecimalOffset: z.number(),
  doIntermediateUpdates: z.boolean(),
  assumeMaxPostSwing: z.boolean(),
  judgments: z.array(HitScoreVisualizerJudgementSchema),
  chainHeadJudgments: z.array(HitScoreVisualizerJudgementSchema),
  chainLinkDisplay: z.object({ text: z.string(), color: z.array(z.number()) }),
  beforeCutAngleJudgments: z.array(
    z.object({ threshold: z.number(), text: z.string() })
  ),
  accuracyJudgments: z.array(z.unknown()),
  afterCutAngleJudgments: z.array(
    z.object({ threshold: z.number(), text: z.string() })
  ),
  timeDependencyJudgments: z.array(z.unknown()),
  randomizeBadCutDisplays: z.boolean(),
  badCutDisplays: z.array(
    z.object({ text: z.string(), type: z.string(), color: z.array(z.number()) })
  ),
  randomizeMissDisplays: z.boolean(),
  missDisplays: z.array(
    z.object({ text: z.string(), color: z.array(z.number()) })
  )
})
//#endregion

//#region CountersPlus
export const CountersPlusCounterSchema = z.object({
  Enabled: z.boolean(),
  Position: z.string(),
  Distance: z.number(),
  CanvasID: z.number()
})

export const CountersPlusSchema = z.object({
  Enabled: z.boolean(),
  HideCombo: z.boolean(),
  HideMultiplier: z.boolean(),
  HideMultiplayerRank: z.boolean(),
  ComboOffset: z.number(),
  MultiplierOffset: z.number(),
  ItalicText: z.boolean(),
  AprilFoolsTomfoolery: z.boolean(),
  HUDConfig: z.object({
    MainCanvasSettings: z.object({
      Name: z.string(),
      ParentedToBaseGameHUD: z.boolean(),
      IgnoreNoTextAndHUDOption: z.boolean(),
      Size: z.number(),
      PositionScale: z.number(),
      Pos_X: z.number(),
      Pos_Y: z.number(),
      Pos_Z: z.number(),
      MatchBaseGameHUDDepth: z.boolean(),
      Rot_X: z.number(),
      Rot_Y: z.number(),
      Rot_Z: z.number(),
      AttachHUDToCamera: z.boolean(),
      AttachedCamera: z.string(),
      IgnoreShockwaveEffect: z.boolean(),
      CurveRadius: z.number(),
      DistanceModifier: z.number()
    }),
    OtherCanvasSettings: z.array(z.unknown())
  }),
  MissedConfig: z.object({
    Enabled: z.boolean(),
    Position: z.string(),
    Distance: z.number(),
    CountBadCuts: z.boolean(),
    CanvasID: z.number()
  }),
  NoteConfig: z.object({
    Enabled: z.boolean(),
    Position: z.string(),
    Distance: z.number(),
    ShowPercentage: z.boolean(),
    DecimalPrecision: z.number(),
    CanvasID: z.number()
  }),
  ProgressConfig: z.object({
    Enabled: z.boolean(),
    Position: z.string(),
    Distance: z.number(),
    Mode: z.string(),
    ProgressTimeLeft: z.boolean(),
    IncludeRing: z.boolean(),
    CanvasID: z.number()
  }),
  ScoreConfig: z.object({
    Enabled: z.boolean(),
    Position: z.string(),
    Distance: z.number(),
    Mode: z.string(),
    DecimalPrecision: z.number(),
    DisplayRank: z.boolean(),
    CustomRankColors: z.boolean(),
    SSColor: z.string(),
    SColor: z.string(),
    AColor: z.string(),
    BColor: z.string(),
    CColor: z.string(),
    DColor: z.string(),
    EColor: z.string(),
    CanvasID: z.number()
  }),
  PBConfig: z.object({
    Enabled: z.boolean(),
    Position: z.string(),
    Distance: z.number(),
    Mode: z.string(),
    BetterColor: z.string(),
    DefaultColor: z.string(),
    DecimalPrecision: z.number(),
    TextSize: z.number(),
    UnderScore: z.boolean(),
    HideFirstScore: z.boolean(),
    CanvasID: z.number()
  }),
  SpeedConfig: z.object({
    Enabled: z.boolean(),
    Position: z.string(),
    Distance: z.number(),
    DecimalPrecision: z.number(),
    Mode: z.string(),
    CanvasID: z.number()
  }),
  CutConfig: z.object({
    Enabled: z.boolean(),
    Position: z.string(),
    Distance: z.number(),
    SeparateSaberCounts: z.boolean(),
    SeparateCutValues: z.boolean(),
    AveragePrecision: z.number(),
    IncludeArcs: z.boolean(),
    IncludeChains: z.boolean(),
    CanvasID: z.number()
  }),
  SpinometerConfig: z.object({
    Enabled: z.boolean(),
    Position: z.string(),
    Distance: z.number(),
    Mode: z.string(),
    CanvasID: z.number()
  }),
  NotesLeftConfig: z.object({
    Enabled: z.boolean(),
    Position: z.string(),
    Distance: z.number(),
    LabelAboveCount: z.boolean(),
    CanvasID: z.number()
  }),
  FailsConfig: z.object({
    Enabled: z.boolean(),
    Position: z.string(),
    Distance: z.number(),
    ShowRestartsInstead: z.boolean(),
    CanvasID: z.number()
  }),
  MultiplayerRankConfig: z.object({
    Enabled: z.boolean(),
    Position: z.string(),
    Distance: z.number(),
    CanvasID: z.number()
  }),
  CustomCounters: z.object()
})
//#endregion'

export const ChromaUserEnvironmentSchema = z.object({
  version: z.string(),
  name: z.string(),
  author: z.string(),
  environmentVersion: z.string(),
  environmentName: z.string(),
  description: z.string(),
  features: z.object(),
  environment: z.array(z.object()),
  materials: z.object(),
})


