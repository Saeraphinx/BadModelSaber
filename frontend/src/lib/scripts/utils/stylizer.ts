import { m } from "$lib/paraglide/messages";
import { getLocale } from "$lib/paraglide/runtime";
import { AssetFileFormat, Status, UserPermissions } from "../api/DBTypes";

// export function capitalizeFirstLetter(str: any): string {
//   if (!str) return ``; // Handle empty strings
//   if (typeof str !== 'string') return ``; // Ensure input is a string
//   return str.charAt(0).toUpperCase() + str.slice(1);
// }

export function getStatusString(status: Status): string {
  return m[`enums.status.${status}`]();
}


// export function getAssetTypeString(type: AssetFileFormat): string {
//   switch (type) {
//     case AssetFileFormat.Camera2Config_JSON:
//       return ".json (Camera2)";
//     case AssetFileFormat.ChromaEnv_JSON:
//       return ".json (Chroma)";
//     case AssetFileFormat.CountersPlusConfig_JSON:
//       return ".json (Counters+)";
//     case AssetFileFormat.HSVConfig_JSON:
//       return ".json (HSV)";
//     default:
//       return `.${type.split('_')[1]}`;  // Default case for other formats
//   }
// }

export function getAssetTypeData(format: AssetFileFormat): {
  rawString: AssetFileFormat;
  formatString: string;
  typeString: string;
  translatedType: string;
  combinedString: string;
} {
  let type = format.split('_')[0]//.replaceAll('-', ' ');
  let translatedType = type;
  try {
    // @ts-expect-error
    translatedType = m[`enums.assetTypes.${type}`]();
  } catch (e) {
    console.debug(`Translation for asset type ${type} not found for locale ${getLocale()}.`);
    translatedType = type;
  }
  let fileFormat = `.${format.split('_')[1].toLowerCase()}`;

  switch (format) {
    case AssetFileFormat.HSVConfig_JSON:
      return {
        rawString: format,
        formatString: fileFormat,
        typeString: type,
        translatedType: "HitScoreVisualizer",
        combinedString: `HSV (${fileFormat})`,
      };
    default: 
      return {
        rawString: format,
        formatString: fileFormat,
        typeString: type,
        translatedType: translatedType,
        combinedString: `${translatedType} (${fileFormat})`,
      };
  }
}

export function getAssetTypeCategories(): Map<string, ReturnType<typeof getAssetTypeData>[]> {
  let categories: Map<string, ReturnType<typeof getAssetTypeData>[]> = new Map();
  for (let format in AssetFileFormat) {
    let assetTypeData = getAssetTypeData(AssetFileFormat[format as keyof typeof AssetFileFormat]);
    let category = categories.get(assetTypeData.typeString) ?? [];
    category.push(assetTypeData);
    categories.set(assetTypeData.typeString, category);
  }
  let singleFormats: ReturnType<typeof getAssetTypeData>[] = [];
  for (let [key, value] of categories) {
    if (value.length == 1 || key == 'sound') { // Group single formats and Sound into Other
      categories.delete(key);
      singleFormats.push(...value);
    }
  }

  // file format that goes into config
  let configCategories = [`.json`];
  // Create Other and Config categories & set their position
  categories.set('config', []);
  categories.set('other', []);
  for (let format of singleFormats) {
    if (configCategories.includes(format.formatString)) {
      let category = categories.get('config') ?? [];
      category.push(format);
      categories.set('config', category);
    } else {
      let category = categories.get('other') ?? [];
      category.push(format);
      categories.set('other', category);
    }
  }

  let sabers = categories.get('saber');
  if (sabers) {
    categories.delete('saber');
    categories.set(m["enums.assetTypes.plurals.saber"](), sabers);
  } 
  let notes = categories.get('note');
  if (notes) {
    categories.delete('note');
    categories.set(m["enums.assetTypes.plurals.note"](), notes);
  }
  let walls = categories.get('wall');
  if (walls) {
    categories.delete('wall');
    categories.set(m["enums.assetTypes.plurals.wall"](), walls);
  }
  let configs = categories.get('config');
  if (configs) {
    categories.delete('config');
    categories.set(m["enums.assetTypes.plurals.config"](), configs);
  }
  let other = categories.get('other');
  if (other) {
    categories.delete('other');
    categories.set(m["enums.assetTypes.plurals.other"](), other);
  }

  return categories;
}

export function getRoleData(role: string): {
  bgColor: string;
  textColor: string;
  text: string;
  value: UserPermissions | undefined;
  hidden: boolean;
} {
  switch (role) {
    case UserPermissions.C_Admin:
      return {
        bgColor: 'bg-red-500',
        textColor: 'text-white',
        text: m["enums.roles.admin"](),
        value: UserPermissions.C_Admin,
        hidden: false,
      }
    case UserPermissions.C_Developer:
      return {
        bgColor: 'bg-pink-500',
        textColor: 'text-white',
        text: m["enums.roles.developer"](),
        value: UserPermissions.C_Developer,
        hidden: false,
      }
    case UserPermissions.C_Moderator:
      return {
        bgColor: 'bg-blue-500',
        textColor: 'text-black',
        text: m["enums.roles.moderator"](),
        value: UserPermissions.C_Moderator,
        hidden: false,
      }
    case UserPermissions.C_BSMG_Staff:
      return {
        bgColor: 'bg-[#3b397a]',
        textColor: 'text-white',
        text: m["enums.roles.bsmgStaff"](),
        value: UserPermissions.C_BSMG_Staff,
        hidden: false,
      }
    case UserPermissions.C_Modeler:
      return {
        bgColor: 'bg-[#59d8f0]',
        textColor: 'text-black',
        text: m["enums.roles.3dArtist"](),
        value: UserPermissions.C_Modeler,
        hidden: false,
      }
    case UserPermissions.C_System:
      return {
        bgColor: 'bg-gray-800',
        textColor: 'text-white',
        text: m["enums.roles.system"](),
        value: UserPermissions.C_System,
        hidden: false,
      }
    default:
      return {
        bgColor: 'bg-gray-500',
        textColor: 'text-white',
        text: m["enums.roles.unknown"](),
        value: undefined,
        hidden: true,
      }; // Default color for unknown roles
  }
}

export enum KnownSponsorUrls {
  Pixiv,
  Patreon,
  KoFi
}

export function getSponserUrlData(sponsorUrl: string | string[] | null) {

}

export function getRelativeTimeString(date: Date, lang = navigator.language) {
  // Allow dates or times to be passed
  const timeMs = typeof date === "number" ? date : date.getTime();
  const diff = timeMs - Date.now();
  const absDiff = Math.abs(diff);

  const units = [
    { unit: "year", ms: 31536000000 },
    { unit: "month", ms: 2628000000 },
    { unit: "week", ms: 604800000 },
    { unit: "day", ms: 86400000 },
    { unit: "hour", ms: 3600000 },
    { unit: "minute", ms: 60000 },
    { unit: "second", ms: 1000 },
  ];

  for (const { unit, ms } of units) {
    if (absDiff >= ms || unit === "second") {
      const value = Math.round(diff / ms);
      const rtf = new Intl.RelativeTimeFormat(lang, { numeric: "auto", style: "long" });
      return rtf.format(value, unit as Intl.RelativeTimeFormatUnit);
    }
  }
}