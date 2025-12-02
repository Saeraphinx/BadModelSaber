//#region HitScoreVisualizer
import { features } from "process"
import { z } from "zod"
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
  environment: z.object(),
  materials: z.object(),
})


