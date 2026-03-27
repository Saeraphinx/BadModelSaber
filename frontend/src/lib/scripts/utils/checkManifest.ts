import { parse, Range, SemVer, validRange } from "semver";
import type { GameVersionApiV3 } from "../api/DBTypes";
import type { Manifest } from "../api/modParser";
import { m } from "../../paraglide/messages";
import type { LocalizedString } from "@inlang/paraglide-js";

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

export function manifestAllDependenciesExist(manifest: Manifest, dependencies: {pName: string, sv: string}[]): LocalizedString[] {
  let issues: LocalizedString[] = [];
  if (!manifest.dependsOn) {
    if (dependencies.length > 0) {
      return [m["mods.manifestChecks.dependencies.manifestMissingdependsOn"]()];
    } else {
      return [];
    }
  };

  for (const dep of dependencies) {
    let found = false;
    let depGameVersion = new Range(dep.sv, true);
    if (!depGameVersion) {
      issues.push(m["mods.manifestChecks.dependencies.webInvalidRange"]({ depName: dep.pName, sv: dep.sv }));
      continue;
    }

    for (const [depName, depVersion] of Object.entries(manifest.dependsOn!)) {
      if (depName === dep.pName) {
        let manifestDepGameVersion = new Range(depVersion, true);
        if (depGameVersion.raw != manifestDepGameVersion.raw) {
          found = true;
        }
      }
    }
    issues.push(m["mods.manifestChecks.dependencies.webDependencyNotFound"]({ depName: dep.pName, sv: dep.sv }));
  };

  // do the same check but the other way around, to catch any dependencies that are in the manifest but not in the provided dependencies
  for (const [depName, depVersion] of Object.entries(manifest.dependsOn)) {
    let manifestDepVersion = new Range(depVersion, true);
    if (!manifestDepVersion) {
      issues.push(m["mods.manifestChecks.dependencies.manifestInvalidRange"]({ depName, sv: depVersion }));
      continue;
    }

    dependencies.every(dep => {
      let found = false;
      if (dep.pName === depName) {
        let depGameVersion = new Range(dep.sv, true);
        if (depGameVersion.raw != manifestDepVersion.raw) {
          found = true;
        }
      }
      if (!found) {
        issues.push(m["mods.manifestChecks.dependencies.manifestDependencyNotFound"]({ depName, sv: depVersion }));
      }
    });
  }

  return issues;
}
    
