import JSZip from "jszip";
import z from "zod";

interface ILog {
  debug: (message: string) => void;
  log: (message: string) => void;
  warn: (message: string) => void;
  error: (message: string) => void;
};

export function getManifestFromString(str: string, doLogs: ILog | null = console): Manifest | null {
  //console.log(str);
  let discoveredJsonStrings = Array.from(str.matchAll(/{[\w\d\s\t\n\r\!-~]{10,}}/gmi)).map((match) => match[0]);
  //console.log(discoveredJsonStrings);

  if (!discoveredJsonStrings || discoveredJsonStrings.length <= 0) {
    doLogs ? doLogs.warn(`No JSON string found in manifest.json for version`) : null;
  }
  let finalManifest: Manifest | null = null;
  discoveredJsonStrings?.forEach((jsonString) => {
    try {
      let parsed = zManfiest.safeParse(JSON.parse(jsonString));
      //debugger;
      if (parsed.success) {
        finalManifest = parsed.data;
      } else {
        doLogs ? doLogs.debug(`JSON string found in manifest.json did not match expected schema: ${JSON.stringify(parsed.error.issues)}`) : null;
      }
    } catch (err) {
      // not a valid JSON string, ignore
      doLogs ? doLogs.debug(`Failed to parse JSON string in manifest: ${err}`) : null;
    }
  });
  return finalManifest;
}

export async function getManifestFromFile(file: File, doLogs: ILog | null = console): Promise<Manifest | null> {
  let data = await file.text().catch((err) => {
    throw new Error(`Failed to read file ${file.name}: ${err.message}`);
  });

  return getManifestFromString(data, doLogs);
}

export async function getManifestFromZip(file: File | ArrayBuffer | Buffer<ArrayBuffer>, doLogs: ILog | null = console): Promise<Manifest | null> {
  return await JSZip.loadAsync(file).then(async (zip) => {
    let manifestJson: Manifest | null = null;
    for (let fileName in zip.files) {
      const file = zip.files[fileName];
      if (file.dir) continue; // skip directories

      let data = await file.async("text").catch((err) => {
        throw new Error(`Failed to read file ${fileName} from zip archive: ${err.message}`);
      });

      //debugger;

      // pull out manifest.json if it exists
      if (file.name === "manifest.json" || file.name.endsWith(".manifest")) {
        manifestJson = getManifestFromString(data, doLogs);
      } else if (file.name.endsWith(".dll")) {
        if (!data.startsWith("MZ")) {
          doLogs ? doLogs.warn(`File ${fileName} in zip archive is not a valid .dll file, skipping manifest extraction from this file.`) : null;
          continue;
        }
        
        // pull from dll
        let manifestFromDll = getManifestFromString(data, doLogs);
        if (manifestFromDll) {
          manifestJson = manifestFromDll;
        } else {
          doLogs ? doLogs.warn(`No valid manifest found in DLL file ${fileName}.`) : null;
        }
      }
    }
    return manifestJson as Manifest | null;
  })
}

export type Manifest = z.infer<typeof zManfiest>;
const zManfiest =  z.looseObject({
  $schema: z.string(),
  name: z.string().regex(new RegExp("^(.*)$")).describe("plugin name"),
  id: z
    .union([
      z.string().regex(new RegExp("^([^\\s]*)$")).describe("modsaber id"),
      z.null().describe("modsaber id"),
    ])
    .describe("modsaber id"),
  version: z.any().describe("plugin version"),
  gameVersion: z.any().describe("compatible game version"),
  description: z
    .union([
      z.string().describe("plugin description"),
      z.array(z.string()).describe("plugin description"),
    ])
    .describe("plugin description"),
  author: z.string().describe("plugin author"),
  dependsOn: z.object({}).catchall(z.any()).describe("dependencies").optional(),
  conflictsWith: z
    .object({})
    .catchall(z.any())
    .describe("incompatibilities")
    .optional(),
  loadAfter: z
    .array(z.string().describe("the plugin id to load first"))
    .describe("plugins to load before this one")
    .optional(),
  loadBefore: z
    .array(z.string().describe("the plugin id to load after"))
    .describe("plugins to load after this one")
    .optional(),
  features: z.unknown(),
  icon: z.unknown(),
  files: z.unknown(),
  links: z.unknown(),
  misc: z.unknown(),
});