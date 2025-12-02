import { ColorResolvable, Colors, MessageFlags, WebhookClient } from "discord.js";
import { Asset, Status, User } from "./Database.ts";
import { EnvConfig } from "./EnvConfig.ts";
import { Logger } from "./Logger.ts";

export enum WebhookType {
    VerifiedLog = "verified-log",
    StatusLog = "status-log",
}

export class Webhooks {
    private internalWebhook: WebhookClient | null = null;
    private publicWebhook: WebhookClient | null = null;
    private static _instance: Webhooks;

    constructor() {
        if (Webhooks._instance) {
            return Webhooks._instance;
        }
        Webhooks._instance = this;
        this.init();
    }

    private init() {
        // Initialize webhook clients here if needed
    }

    public static async sendUpdateStatus(asset: Asset, userPreformingAction: User, oldStatus: Status, newStatus: Status) {
        if (!this._instance) {
            this._instance = new Webhooks();
        }
        return this._instance.sendUpdateStatus(asset, userPreformingAction, oldStatus, newStatus);
    }

    public async sendUpdateStatus(asset: Asset, userPreformingAction: User, oldStatus: Status, newStatus: Status) {
        if (!this.internalWebhook) {
            return;
        }

        let color: ColorResolvable = 0x000; // Default to black
        switch (newStatus) {
            case Status.Verified:
                color = Colors.Green;
                break;
            case Status.Removed:
                color = Colors.Red;
                break;
            case Status.Pending:
                color = Colors.Yellow;
                break;
            default:
                color = Colors.Grey;
        }

        this.internalWebhook.send({
            embeds: [{
                author: {
                    name: `${userPreformingAction.displayName} (${userPreformingAction.id})`,
                    icon_url: userPreformingAction.avatarUrl,
                    url: `${EnvConfig.server.frontendUrl}/users/${userPreformingAction.id}`
                },
                title: `Asset Status Updated`,
                url: `${EnvConfig.server.frontendUrl}/assets/${asset.id}`,
                thumbnail: asset.iconNames[0] ? {url:`${EnvConfig.server.backendUrl}/files/icons/${asset.iconNames[0]}`} : undefined,
                description: `The status of the asset **${asset.name}** (ID: ${asset.id}) has been updated from **${oldStatus}** to **${newStatus}**.`,
                color: color,
                footer: {
                    text: `Asset ID: ${asset.id}`
                },
            }],
        })

        if (newStatus === Status.Verified && this.publicWebhook) {
            let uploader = await asset.uploader;
            if (!uploader) {
                Logger.warn(`Couldn't find uploader for ${asset.id}, cannot send public webhook.`);
                return;
            }
            this.publicWebhook.send({
                embeds: [{
                    author: {
                        name: `${uploader.displayName}`,
                        icon_url: userPreformingAction.avatarUrl,
                        url: `${EnvConfig.server.frontendUrl}/users/${userPreformingAction.id}`
                    },
                    title: ` ${asset.name}`,
                    url: `${EnvConfig.server.frontendUrl}/assets/${asset.id}`,
                    thumbnail: asset.iconNames[0] ? {url:`${EnvConfig.server.backendUrl}/files/icons/${asset.iconNames[0]}`} : undefined,
                    description: asset.description ? (asset.description.length > 2048 ? asset.description.substring(0, 1000) + "..." : asset.description) : "No description provided.",
                    color: Colors.Green,
                }],
            });
        }
    }
}