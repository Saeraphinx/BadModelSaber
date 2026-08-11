import { Status, UserPermissions, type AssetApiV3, type ProjectApiV3, type UserApiV3, type VersionApiV3 } from "../from_backend/DBExtras";

type UserPermObj = { permissions: { sitewide: UserPermissions[], perGame: Record<string, UserPermissions[]> } }
type CheckRolesInput = { hasAllOf?: UserPermissions[], hasOneOf?: UserPermissions[], denied?: UserPermissions[] };

// #region Get Allowed Statuses
export function getAllowedVersionStatuses(userPermObj: UserPermObj | undefined, allowedToBypass = false, gameName?: string | null): Status[] {
  let statusLookup = [Status.Verified];
  if (userPermObj) {
    statusLookup.push(Status.Unverified);
  }
  if (checkRoles(userPermObj, { hasOneOf: [UserPermissions.Secret_Features] }, gameName)) {
    statusLookup.push(Status.Queue, Status.Testing);
  } else if (checkRoles(userPermObj, { hasOneOf: [UserPermissions.Mods_ViewAll] }, gameName) || allowedToBypass) {
    statusLookup.push(Status.Queue, Status.Testing, Status.Removed, Status.Private);
  }
  return Array.from(new Set(statusLookup));
}

export function getAllowedAssetStatuses(userPermObj: UserPermObj | undefined, allowedToBypass = false, gameName?: string | null): Status[] {
  let statusLookup = [Status.Verified];
  if (userPermObj) {
    statusLookup.push(Status.Unverified);
  }
  if (checkRoles(userPermObj, { hasOneOf: [UserPermissions.Secret_Features] }, gameName)) {
    statusLookup.push(Status.Queue);
  } else if (checkRoles(userPermObj, { hasOneOf: [UserPermissions.Asset_ViewAll] }, gameName) || allowedToBypass) {
    statusLookup.push(Status.Queue, Status.Removed, Status.Private);
  }
  return Array.from(new Set(statusLookup));
}
// #endregion

export function checkAllowView(user: UserApiV3 | undefined, thing: ProjectApiV3 | AssetApiV3): boolean;
export function checkAllowView(user: UserApiV3 | undefined, project: ProjectApiV3, version: VersionApiV3): boolean;
export function checkAllowView(user: UserApiV3 | undefined, thing: ProjectApiV3 | AssetApiV3, version?: VersionApiV3): boolean {
  if (thing.status === Status.Verified || thing.status === Status.Public) {
    return true;
  }

  if (!user) return false;
  let allowedStatuses = [];

  if (`oldId` in thing) {
    allowedStatuses = getAllowedAssetStatuses(user, false, thing.gameName);
  } else {
    allowedStatuses = getAllowedVersionStatuses(user, false, thing.gameName);
  }

  if (version) {
    return allowedStatuses.includes(version.status);
  } else {
    return allowedStatuses.includes(thing.status);
  }
}

export function checkAllowEdit(user: UserApiV3 | undefined, thing: ProjectApiV3 | AssetApiV3): boolean {
  if (!user) return false;
  if (`oldId` in thing) {
    if (thing.uploaderId === user.id) return checkRoles(user, [UserPermissions.Asset_Edit], thing.gameName);
  } else {
    if (thing.authors.some(author => author.id === user.id)) return checkRoles(user, [UserPermissions.Mods_Edit], thing.gameName);
  }

  if (`oldId` in thing) {
    return checkRoles(user, [UserPermissions.Asset_EditAll], thing.gameName);
  } else {
    return checkRoles(user, [UserPermissions.Mods_EditAll], thing.gameName);
  }

  return false;
}

export function checkAllowTranslate(user: UserApiV3 | undefined, thing: ProjectApiV3): boolean {
  if (!user) return false;
  if (thing.authors.some(author => author.id === user.id)) return true;
  if (checkRoles(user, [UserPermissions.Mods_TranslateAll], thing.gameName)) return true;
  return false;
}

export function checkAllowApproval(user: UserApiV3 | undefined, thing: ProjectApiV3 | AssetApiV3): boolean {
  if (!user) return false;
  if (`oldId` in thing) {
    return checkRoles(user, [UserPermissions.Asset_Approval], thing.gameName);
  } else {
    return checkRoles(user, [UserPermissions.Mods_Approval], thing.gameName);
  }
}

export function checkAllowStatusHistory(user: UserApiV3 | undefined, project: ProjectApiV3, versions: VersionApiV3[] | VersionApiV3): boolean {
  if (!user) return false;
  if (!Array.isArray(versions)) {
    versions = [versions];
  }

  if (project.authors.some((a) => a.id === user.id)) return true;
  if (versions.some((v) => v.uploaderId === user.id)) return true;
  if (versions.some((v) => v.statusHistory.some((sh) => sh.userId === user.id))) return true;
  return checkRoles(user, [UserPermissions.Mods_Approval, UserPermissions.Secret_Features], project.gameName);
}

// #region Check Roles
export function checkRoles(userPermObj: UserPermObj | undefined, has: UserPermissions[], gameName?: string | null): boolean;
export function checkRoles(userPermObj: UserPermObj | undefined, has: UserPermissions[], gameName?: `any`): boolean;
export function checkRoles(userPermObj: UserPermObj | undefined, roles: CheckRolesInput, gameName?: string | null): boolean;
export function checkRoles(userPermObj: UserPermObj | undefined, roles: CheckRolesInput, gameName?: `any`): boolean;
export function checkRoles(userPermObj: UserPermObj | undefined, roles: UserPermissions[] | CheckRolesInput, gameName?: string | `any` | null): boolean {
  if (!userPermObj || !userPermObj.permissions) {
    return false;
  }

  if (Array.isArray(roles)) {
    if (gameName === `any`) {
      return roles.some(role => userPermObj.permissions.sitewide.includes(role) || Object.values(userPermObj.permissions.perGame).some(gameRoles => gameRoles.includes(role)));
    } else if (gameName) {
      return roles.some(role => (userPermObj.permissions.sitewide.includes(role) || (userPermObj.permissions.perGame[gameName] && userPermObj.permissions.perGame[gameName].includes(role))));
    } else {
      return roles.some(role => userPermObj.permissions.sitewide.includes(role));
    }
  } else {
    const sitewideCheck = (roles.hasAllOf ? roles.hasAllOf.every(role => userPermObj.permissions.sitewide.includes(role)) : true) &&
      (roles.hasOneOf ? roles.hasOneOf.some(role => userPermObj.permissions.sitewide.includes(role)) : true) &&
      (roles.denied ? roles.denied.every(role => !userPermObj.permissions.sitewide.includes(role)) : true);

    if (gameName === `any`) {
      const anyGameCheck = (roles.hasAllOf ? Object.values(userPermObj.permissions.perGame).some(gameRoles => roles.hasAllOf?.every(role => gameRoles.includes(role))) : true) &&
        (roles.hasOneOf ? Object.values(userPermObj.permissions.perGame).some(gameRoles => roles.hasOneOf?.some(role => gameRoles.includes(role))) : true) &&
        (roles.denied ? Object.values(userPermObj.permissions.perGame).every(gameRoles => roles.denied?.every(role => !gameRoles.includes(role))) : true);
      return sitewideCheck || anyGameCheck;
    } else if (gameName) {
      const perGameCheck = (roles.hasAllOf ? roles.hasAllOf.every(role => userPermObj.permissions.perGame[gameName]?.includes(role) ?? false) : true) &&
        (roles.hasOneOf ? roles.hasOneOf.some(role => userPermObj.permissions.perGame[gameName]?.includes(role) ?? false) : true) &&
        (roles.denied ? roles.denied.every(role => !(userPermObj.permissions.perGame[gameName]?.includes(role) ?? false)) : true);
      return sitewideCheck || perGameCheck;
    } else {
      return sitewideCheck;
    }
  }
}
// #endregion