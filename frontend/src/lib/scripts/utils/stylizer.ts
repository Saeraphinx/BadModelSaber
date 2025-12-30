import { m } from "$lib/paraglide/messages";
import { AssetFileFormat, Status, UserPermissions } from "../api/DBTypes";

export function capitalizeFirstLetter(str: any): string {
  if (!str) return ``; // Handle empty strings
  if (typeof str !== 'string') return ``; // Ensure input is a string
  return str.charAt(0).toUpperCase() + str.slice(1);
}

export function getStatusString(status: Status): string {
  return m[`enums.status.${status}`]();
}


export function getAssetTypeString(type: AssetFileFormat): string {
  switch (type) {
    case AssetFileFormat.Camera2Config_JSON:
      return ".json (Camera2)";
    case AssetFileFormat.ChromaEnv_JSON:
      return ".json (Chroma)";
    case AssetFileFormat.CountersPlusConfig_JSON:
      return ".json (Counters+)";
    case AssetFileFormat.HSVConfig_JSON:
      return ".json (HSV)";
    default:
      return `.${type.split('_')[1]}`;  // Default case for other formats
  }
}

export function getAssetTypeData(format: AssetFileFormat): {
  rawString: AssetFileFormat;
  formatString: string;
  typeString: string;
  combinedString: string;
} {
  let type = format.split('_')[0].replaceAll('-', ' ');
  let translatedType = type;
  try {
    // @ts-expect-error
    translatedType = m[`enums.assetTypes.singular.${type}`]();
  } catch (e) {
    translatedType = capitalizeFirstLetter(type);
  }
  let fileFormat = `.${format.split('_')[1].toLowerCase()}`;

  switch (format) {
    case AssetFileFormat.HSVConfig_JSON:
      return {
        rawString: format,
        formatString: fileFormat,
        typeString: "HitScoreVisualizer",
        combinedString: `HSV (${fileFormat})`,
      };
    default: 
      return {
        rawString: format,
        formatString: fileFormat,
        typeString: translatedType,
        combinedString: `${translatedType} (${fileFormat})`,
      };
  }
}

export function getAssetTypeCategories(): Map<string, ReturnType<typeof getAssetTypeData>[]> {
  let categories: Map<string, ReturnType<typeof getAssetTypeData>[]> = new Map();
  for (let format in AssetFileFormat) {
    let type = `${format.split('_')[0].replaceAll('-', ' ')}`; // Pluralize type
    let category = categories.get(type) ?? [];
    category.push(getAssetTypeData(AssetFileFormat[format as keyof typeof AssetFileFormat]));
    categories.set(type, category);
  }
  let singleFormats: ReturnType<typeof getAssetTypeData>[] = [];
  for (let [key, value] of categories) {
    if (value.length == 1 || key == 'Sounds') { // Group single formats and Sound into Other
      categories.delete(key);
      singleFormats.push(...value);
    }
  }

  // file format that goes into config
  let configCategories = [`.json`];
  // Create Other and Config categories & set their position
  categories.set('Configs', []);
  categories.set('Other', []);
  for (let format of singleFormats) {
    if (configCategories.includes(format.formatString)) {
      let category = categories.get('Configs') ?? [];
      category.push(format);
      categories.set('Configs', category);
    } else {
      let category = categories.get('Other') ?? [];
      category.push(format);
      categories.set('Other', category);
    }
  }

  let sabers = categories.get('Sabers');
  if (sabers) {
    categories.delete('Sabers');
    categories.set(m["enums.assetTypes.plurals.saber"](), sabers);
  } 
  let notes = categories.get('Notes');
  if (notes) {
    categories.delete('Notes');
    categories.set(m["enums.assetTypes.plurals.note"](), notes);
  }
  let walls = categories.get('Walls');
  if (walls) {
    categories.delete('Walls');
    categories.set(m["enums.assetTypes.plurals.wall"](), walls);
  }
  let configs = categories.get('Configs');
  if (configs) {
    categories.delete('Configs');
    categories.set(m["enums.assetTypes.plurals.config"](), configs);
  }
  let other = categories.get('Other');
  if (other) {
    categories.delete('Other');
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