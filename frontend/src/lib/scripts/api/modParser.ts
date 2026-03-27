import JSZip from "jszip";
import z from "zod";

export function getManifestFromString(str: string): Manifest | null {
  //console.log(str);
  let discoveredJsonStrings = /{[\w\d\s\t\n\r\!-~]+}/gmi.exec(str);
  //console.log(discoveredJsonStrings);

  if (!discoveredJsonStrings || discoveredJsonStrings.length <= 0) {
    console.warn(`No JSON string found in manifest.json for version`);
  }
  let finalManifest: Manifest | null = null;
  discoveredJsonStrings?.forEach((jsonString) => {
    try {
      let parsed = zManfiest.safeParse(JSON.parse(jsonString));
      //debugger;
      if (parsed.success) {
        finalManifest = parsed.data;
      } else {
        console.log(`JSON string found in manifest.json did not match expected schema: ${JSON.stringify(parsed.error.issues)}`);
      }
    } catch (err) {
      // not a valid JSON string, ignore
      console.log(`Failed to parse JSON string in manifest: ${err}`);
    }
  });
  return finalManifest;
}

export async function getManifestFromFile(file: File): Promise<Manifest | null> {
  let data = await file.text().catch((err) => {
    throw new Error(`Failed to read file ${file.name}: ${err.message}`);
  });

  return getManifestFromString(data)
}

export async function getManifestFromZip(file: File): Promise<Manifest | null> {
  return await JSZip.loadAsync(file).then((zip) => {
    let manifestJson: Manifest | null = null;
    zip.forEach(async (relativePath, file) => {
      if (file.dir) return;

      let data = await file.async("text").catch((err) => {
        throw new Error(`Failed to read file ${relativePath} from zip archive: ${err.message}`);
      });

      // pull out manifest.json if it exists
      if (file.name === "manifest.json") {
        manifestJson = getManifestFromString(data);
      } else if (file.name.endsWith(".dll")) {
        if (!data.startsWith("MZ")) {
          console.warn(`File ${relativePath} in zip archive is not a valid .dll file, skipping manifest extraction from this file.`);
          return;
        }
        
        // pull from dll
        let manifestFromDll = getManifestFromString(data);
        if (manifestFromDll) {
          manifestJson = manifestFromDll;
        } else {
          console.warn(`No valid manifest found in DLL file ${relativePath}.`);
        }
      }
    });
    return manifestJson;
  })
}

export type Manifest = z.infer<typeof zManfiest>;
const zManfiest =  z.object({
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
  features: z
    .object({})
    .catchall(z.any())
    .describe("features to enable for plugin")
    .optional(),
  icon: z
    .string()
    .regex(new RegExp(".*\\.png"))
    .describe("the icon to represent the plugin, as a PNG")
    .optional(),
  files: z
    .array(
      z
        .string()
        .describe(
          "the path to a file distributed with the mod, relative to the installation directory"
        )
    )
    .describe(
      "A list of files that are associated with this mod. If this is a bare manifest, must include *all* files distributed with the mod. Otherwise, it may exclude the assembly it is embedded in."
    )
    .optional(),
  links: z
    .object({
      "project-home": z
        .any()
        .describe(
          "a link to the project home page. if not specified, same as project-source"
        )
        .optional(),
      "project-source": z
        .any()
        .describe(
          "a link to the project source. if not specified, same as project-home."
        )
        .optional(),
      donate: z.any().describe("a link to a donations page").optional(),
    })
    .describe("various links associated with the mod")
    .optional(),
  misc: z
    .object({
      "plugin-hint": z
        .any()
        .describe("a hint for the loader for where to find the plugin type")
        .optional(),
    })
    .describe("miscellaneous properties")
    .optional(),
});