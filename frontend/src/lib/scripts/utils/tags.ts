import type { ClassValue } from "svelte/elements";
import { AssetFileFormat, Tags } from "../from_backend/DBExtras";
import { i18n } from "$lib/scripts/i18n";

const { t, language } = i18n();

export function getTagData(tag: Tags, assetType: AssetFileFormat, shouldShowInternal: boolean = false): { translatedTag: string, category: string, outlineColor: ClassValue, disabled: boolean, animated: boolean } {
  let splitType = assetType.split("_");
  let type = splitType[0];
  let format = splitType[1];
  let category: string = "General";
  let intClass: ClassValue = `bg-[#333333]`; // Default class
  let disabled = false;
  let animated = false;
  // #region colors
  switch (tag.replaceAll(` `, ``)) {
    case Tags.CustomColors:
      intClass = `bg-linear-to-r from-[#ff3030] via-[#F0F] to-[#3702fF]`;
      animated = true;
      break;
    case Tags.CustomTrails:
    case Tags.CustomBombs:
    case Tags.CustomArrows:
      intClass = `bg-linear-to-r from-[#ff3030] via-[#FF0] to-[#00F0a7]`;
      animated = true;
      break;
    case Tags.Pride:
      intClass = `bg-pride`;
      break;
    case Tags.NSFW:
      intClass = `bg-[#ff7f00]`;
      break;
    case Tags.FBT:
    case Tags.Cloth:
    case Tags.DynamicBones:
    case Tags.Animations:
    case Tags.Sounds:
    case Tags.AudioLink:
    case Tags.Reactive:
    case Tags.Particles:
    case Tags.Shaders:
      intClass = `bg-[#33aaFF]`;
      break;
    case Tags.Hitsound:
    case Tags.BadHitsound:
    case Tags.MenuClick:
    case Tags.FirstPerson:
    case Tags.ThirdPerson:
      intClass = `bg-[#FF33AA]`;
      break;

    case Tags.Meme:
    case Tags.Thin:
    case Tags.Large:
    case Tags.Acc:
    case Tags.Sword:
    case Tags.Simple:
    case Tags.VideoGame:
    case Tags.Anime:
    case Tags.Halloween:
    case Tags.Holiday:
    case Tags.Christmas:
    case Tags.Pro:
    case Tags.Underswing:
    case Tags.TimeDependence:
      intClass = `bg-[#33FFAA]`;
      break;

    case Tags.Featured:
    case Tags.Contest:
      intClass = `bg-[#7f65ee]`;
      break;
    default:
      intClass = `bg-[#833333]`;
      break;
  }
  //#endregion colors
  // #region categories & disabled
  switch (tag) {
    case Tags.CustomColors:
    case Tags.CustomTrails:
    case Tags.CustomBombs:
    case Tags.CustomArrows:
    case Tags.FBT:
    case Tags.Cloth:
    case Tags.DynamicBones:
    case Tags.AudioLink:
    case Tags.Reactive:
    case Tags.Particles:
    case Tags.Animations:
    case Tags.Sounds:
    case Tags.Shaders:
      if (type === `hitscorevisualizer-config` || type === `counters-plus-config` || type === `camera2-config` || type === `sound` || type === `banner` || type === `chroma-environment`) {
        disabled = true;
      }
    case Tags.NSFW:
      category = t(`enums.tagCategories.features`);
      break;

    case Tags.Hitsound:
    case Tags.BadHitsound:
    case Tags.MenuClick:
      category = t(`enums.tagCategories.typeSpecific`);
      if (type !== `sound`) disabled = true;
      break;

    case Tags.FirstPerson:
    case Tags.ThirdPerson:
      if (type !== `camera2`) disabled = true;
      category = t(`enums.tagCategories.typeSpecific`);
      break;

    case Tags.Featured:
    case Tags.Contest:
      category = t(`enums.tagCategories.internal`);
      disabled = !shouldShowInternal;
      break;
    case Tags.Pride:
    case Tags.Meme:
    case Tags.Thin:
    case Tags.Large:
    case Tags.Acc:
    case Tags.Sword:
    case Tags.Simple:
    case Tags.VideoGame:
    case Tags.Anime:
    case Tags.Halloween:
    case Tags.Holiday:
    case Tags.Christmas:
    case Tags.Pro:
    case Tags.Underswing:
    case Tags.TimeDependence:
    default:
      category = t(`enums.tagCategories.general`);
      break;
  }
  // #endregion categories & disabled
  let translatedTag:string;
  try {
    translatedTag = t(`enums.tags.${tag}`);
  } catch (e) {
    // Fallback to tag key if translation not found
    console.warn(`Translation for tag ${tag} not found for locale ${language}.`);
    translatedTag = tag;
  }
  return {
    translatedTag: translatedTag,
    category,
    outlineColor: intClass,
    animated, 
    disabled,
  };
}

export function getAllTagsData(assetType: AssetFileFormat, shouldShowInternal=false): { tag: Tags, data: ReturnType<typeof getTagData> }[] {
  return Object.values(Tags).map((tag) => ({
    tag,
    data: getTagData(tag, assetType, shouldShowInternal),
  }));
}