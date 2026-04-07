import { ThingRequest } from "./ThingRequest.ts";
import { User } from "./User.ts";

export interface IReportable {
    report(user: User, reason: string): Promise<ThingRequest>;
}

export interface IPermissionsChecks {
    canView(user: User | undefined | null): Promise<boolean> | boolean;
    canEdit(user: User | undefined | null): Promise<boolean> | boolean;
}