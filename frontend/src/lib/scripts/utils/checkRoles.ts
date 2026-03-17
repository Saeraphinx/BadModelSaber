import type { UserPermissions } from "../api/DBTypes";

type UserPermObj = { permissions: { sitewide: UserPermissions[], perGame: Record<string, UserPermissions[]> } }
type CheckRolesInput = { hasAllOf?: UserPermissions[], hasOneOf?: UserPermissions[], denied?: UserPermissions[] };

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
      return roles.every(role => (userPermObj.permissions.sitewide.includes(role) || (userPermObj.permissions.perGame[gameName] && userPermObj.permissions.perGame[gameName].includes(role))));
    } else {
      return roles.every(role => userPermObj.permissions.sitewide.includes(role));
    }
  } else {
    const sitewideCheck = (roles.hasAllOf ? roles.hasAllOf.every(role => userPermObj.permissions.sitewide.includes(role)) : true) &&
      (roles.hasOneOf ? roles.hasOneOf.some(role => userPermObj.permissions.sitewide.includes(role)) : true) &&
      (roles.denied ? roles.denied.every(role => !userPermObj.permissions.sitewide.includes(role)) : true);

    if (gameName === `any`) {
      const anyGameCheck = (roles.hasAllOf ? Object.values(userPermObj.permissions.perGame).some(gameRoles => roles.hasAllOf?.every(role => gameRoles.includes(role))) : true) &&
        (roles.hasOneOf ? Object.values(userPermObj.permissions.perGame).some(gameRoles => roles.hasOneOf?.some(role => gameRoles.includes(role))) : true) &&
        (roles.denied ? Object.values(userPermObj.permissions.perGame).every(gameRoles => roles.denied?.every(role => !gameRoles.includes(role))) : true);
      return sitewideCheck && anyGameCheck;
    } else if (gameName) {
      const perGameCheck = (roles.hasAllOf ? roles.hasAllOf.every(role => userPermObj.permissions.perGame[gameName]?.includes(role) ?? false) : true) &&
        (roles.hasOneOf ? roles.hasOneOf.some(role => userPermObj.permissions.perGame[gameName]?.includes(role) ?? false) : true) &&
        (roles.denied ? roles.denied.every(role => !(userPermObj.permissions.perGame[gameName]?.includes(role) ?? false)) : true);
      return sitewideCheck && perGameCheck;
    } else {
      return sitewideCheck;
    }
  }
}