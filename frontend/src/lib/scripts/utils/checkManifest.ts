import { parse, Range, SemVer } from "semver";
import type { GameVersionApiV3 } from "../from_backend/DBExtras";
import type { Manifest } from "../from_backend/modParser";
import { m } from "$lib/paraglide/messages";

export function manifestGameVersionIsLowestSupportedVersion(manifest: Manifest, supportedGameVersions: GameVersionApiV3[]): boolean {
  if (supportedGameVersions.length <= 0) {
    console.warn(`No supported game versions provided for manifest game version check, skipping check.`);
    return true;
  }
  let manifestGameVersion: SemVer | null = parse(manifest.gameVersion, true);
  if (!manifestGameVersion) return false;

  supportedGameVersions.sort((a, b) => parse(a.version, true)!.compare(parse(b.version, true)!));

  let lowestSupportedGameVersion = parse(supportedGameVersions[0].version, true);
  if (!lowestSupportedGameVersion) return false;
  return manifestGameVersion.compare(lowestSupportedGameVersion) >= 0;
}

export function manifestAllDependenciesExist(manifest: Manifest, webDependencies: {pNameId: string, sv: string}[]): string[] {
  let issues: string[] = [];
  if (!manifest.dependsOn) {
    if (webDependencies.length > 0) {
      return [m[`mods.manifestChecks.dependencies.manifestMissingdependsOn`]()];
    } else {
      return [];
    }
  }

  for (const webDep of webDependencies) {
    let found = false;
    let webDepSVR = new Range(webDep.sv, true);
    if (!webDepSVR) {
      issues.push(m[`mods.manifestChecks.dependencies.webInvalidRange`]({ depName: webDep.pNameId, sv: webDep.sv }));
      continue;
    }

    for (const [manDepName, manDepVersion] of Object.entries(manifest.dependsOn!)) {
      if (manDepName === webDep.pNameId) {
        let manDepSVR = new Range(manDepVersion, true);
        if (webDepSVR.raw == manDepSVR.raw) {
          found = true;
        }
      }
    }
    if (!found) {
      issues.push(m[`mods.manifestChecks.dependencies.webDependencyNotFound`]({ depName: webDep.pNameId, sv: webDep.sv }));
    }
  }

  // do the same check but the other way around, to catch any dependencies that are in the manifest but not in the provided dependencies
  for (const [manDepName, manDepVersion] of Object.entries(manifest.dependsOn)) {
    let manifestDepVersion = new Range(manDepVersion, true);
    if (!manifestDepVersion) {
      issues.push(m[`mods.manifestChecks.dependencies.manifestInvalidRange`]({ depName: manDepName, sv: manDepVersion }));
      continue;
    }

    let wDep = webDependencies.find(d => d.pNameId === manDepName)
    if (!wDep) {
      issues.push(m[`mods.manifestChecks.dependencies.manifestDependencyNotFound`]({ depName: manDepName, sv: manDepVersion }));
      continue;
    }

    let wDepVersion = new Range(wDep.sv, true);
    if (!wDepVersion || wDepVersion.raw != manifestDepVersion.raw) {
      issues.push(m[`mods.manifestChecks.dependencies.webInvalidRange`]({ depName: wDep.pNameId, sv: wDep.sv }));
      continue;
    }
  }

  return issues;
}

