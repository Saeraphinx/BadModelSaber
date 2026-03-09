import { ThingRequest } from "./ThingRequest.ts";
import { User } from "./User.ts";

export interface IReportable {
    report(user: User, reason: string): Promise<ThingRequest>;
}

export interface IViewable {
    canView(user: User | undefined | null): Promise<boolean> | boolean;
}

export interface IEditable {
    canEdit(user: User | undefined | null): Promise<boolean> | boolean;
}