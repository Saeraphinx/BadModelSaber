import { AssetFileFormat, UserPermissions } from "../api/DBTypes";

export function capitalizeFirstLetter(str: any): string {
  if (!str) return ``; // Handle empty strings
  if (typeof str !== 'string') return ``; // Ensure input is a string
  return str.charAt(0).toUpperCase() + str.slice(1);
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

function toTitleCase(str: string): string {
    return str.replace(/\w\S*/g, (txt) => {
        return txt.charAt(0).toUpperCase() + txt.substr(1).toLowerCase();
    });
}

export function getAssetTypeData(format: AssetFileFormat): {
  formatString: string;
  typeString: string;
  combinedString: string;
} {
  let type = format.split('_')[0].replaceAll('-', ' ');
  let fileFormat = `.${format.split('_')[1].toLowerCase()}`;
  let capitalType = toTitleCase(type);

  switch (format) {
    case AssetFileFormat.HSVConfig_JSON:
      return {
        formatString: fileFormat,
        typeString: "HitScoreVisualizer",
        combinedString: `HSV (${fileFormat})`,
      };
    default: 
      return {
        formatString: fileFormat,
        typeString: capitalType,
        combinedString: `${capitalType} (${fileFormat})`,
      };
  }
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
        text: 'Admin',
        value: UserPermissions.C_Admin,
        hidden: false,
      }
    case UserPermissions.C_Developer:
      return {
        bgColor: 'bg-pink-500',
        textColor: 'text-white',
        text: 'Developer',
        value: UserPermissions.C_Developer,
        hidden: false,
      }
    case UserPermissions.C_Moderator:
      return {
        bgColor: 'bg-blue-500',
        textColor: 'text-black',
        text: 'Moderator',
        value: UserPermissions.C_Moderator,
        hidden: false,
      }
    case UserPermissions.C_BSMG_Staff:
      return {
        bgColor: 'bg-[#3b397a]',
        textColor: 'text-white',
        text: 'BSMG Staff',
        value: UserPermissions.C_BSMG_Staff,
        hidden: false,
      }
    case UserPermissions.C_Modeler:
      return {
        bgColor: 'bg-[#59d8f0]',
        textColor: 'text-black',
        text: '3D Modeler',
        value: UserPermissions.C_Modeler,
        hidden: false,
      }
    default:
      return {
        bgColor: 'bg-gray-500',
        textColor: 'text-white',
        text: 'Unknown Role',
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