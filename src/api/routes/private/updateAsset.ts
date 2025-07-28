import { Router } from "express";
import { auth, validate } from "../../../api/RequestUtils.ts";
import { AssetRequest, RequestType, UserRole } from "../../../shared/Database.ts";
import { Validator } from "../../../shared/Validator.ts";
import { request } from "http";
import { parseErrorMessage } from "../../../shared/Tools.ts";

export class UpdateAssetRoutes {
    public static loadRoutes(router: Router): void {
    }
}