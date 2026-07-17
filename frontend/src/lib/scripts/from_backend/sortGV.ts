import { coerce } from "semver";

type GameVersion = { gameName: string, version: string }

export function gvCompare(a: GameVersion, b: GameVersion): number {
  if (a.gameName < b.gameName) {
    return -1;
  } else if (a.gameName > b.gameName) {
    return 1;
  } else {
    // if game names are the same, sort by version using semver
    const aSV = coerce(a.version, { loose: true });
    const bSV = coerce(b.version, { loose: true });
    if (!aSV || !bSV) {
      // if either version can't be coerced, sort by version string
      if (a.version < b.version) {
        return -1;
      } else if (a.version > b.version) {
        return 1;
      } else {
        return 0;
      }
    } else {
      return aSV.compare(bSV);
    }
  }
}

export function gvCompareDecending(a: GameVersion, b: GameVersion): number {
  return gvCompare(b, a);
}