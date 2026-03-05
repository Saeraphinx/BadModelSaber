import { APIMessage, ColorResolvable, Colors, EmbedBuilder, MessagePayload, WebhookClient, WebhookMessageCreateOptions } from "discord.js";
import { Asset, Game, GameWebhookConfig, Project, Status, User, Version, WebhookLogType } from "./Database.ts";
import { EnvConfig } from "./EnvConfig.ts";

/* 

This file contains all logic related to managing and sending webhooks, including generating payloads for different types of webhook logs. It interfaces with the Game table to retrieve webhook configurations and send the payloads.

Each webhook log type can be turned on and off for each game, and can be designated as an "asset webhook" or not. 

*/

const userUrl = `${EnvConfig.server.frontendUrl}/user/`;
type GameWebhookConfigWithClient = GameWebhookConfig & { client: WebhookClient };
export class Webhooks {
    private static webhookClients: Map<string, GameWebhookConfigWithClient[]> = new Map();


    // #region Webhook Management
    public static async registerWebhooks() {
        let games = await Game.findAll();

        for (let game of games) {
            this.registerWebhook(game);
        }
    }

    public static async registerWebhook(game: Game) {
        let webhookConfigs: GameWebhookConfigWithClient[] = [];
        for (let webhookConfig of game.webhookConfig) {
            let client = new WebhookClient({ url: webhookConfig.url });
            webhookConfigs.push({
                id: webhookConfig.id,
                url: webhookConfig.url,
                types: webhookConfig.types,
                isAssetWebhook: webhookConfig.isAssetWebhook,
                client: client
            });
        }
        this.webhookClients.set(game.name, webhookConfigs);
    }

    public static async sendWebhookLog(gameName: string, type: WebhookLogType, isAssetWebhook: boolean, payload: string | MessagePayload | WebhookMessageCreateOptions): Promise<APIMessage[] | undefined> {
        let webhookConfigs = this.webhookClients.get(gameName);
        if (!webhookConfigs) return;

        let results: APIMessage[] = [];
        for (let webhookConfig of webhookConfigs) {
            if (webhookConfig.types.includes(type) && webhookConfig.isAssetWebhook === isAssetWebhook) {
                try {
                    let res = await webhookConfig.client.send(payload);
                    results.push(res);
                } catch (error) {
                    console.error(`Failed to send webhook to ${webhookConfig.url}: ${error}`);
                }
            }
        }
        return results;
    }
    // #endregion

}

export class WebhookPayloadGenerator {
    public static generateInternalStatusUpdateEmbedPayload(asset: Asset, userPreformingAction: User, oldStatus: Status, newStatus: Status): WebhookMessageCreateOptions {
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

        let payload = {
            embeds: [{
                author: {
                    name: `${userPreformingAction.displayName} (${userPreformingAction.id})`,
                    icon_url: userPreformingAction.avatarUrl,
                    url: `${EnvConfig.server.frontendUrl}/users/${userPreformingAction.id}`
                },
                title: `Asset Status Updated`,
                url: `${EnvConfig.server.frontendUrl}/assets/${asset.id}`,
                thumbnail: asset.iconNames[0] ? { url: `${EnvConfig.server.backendUrl}/files/icons/${asset.iconNames[0]}` } : undefined,
                description: `The status of the asset **${asset.name}** (ID: ${asset.id}) has been updated from **${oldStatus}** to **${newStatus}**.`,
                color: color,
                footer: {
                    text: `Asset ID: ${asset.id}`
                },
            }],
        };

        return payload;
    }

    public static async generatePublicNewAssetEmbedPayload(asset: Asset): Promise<WebhookMessageCreateOptions> {
        let uploader = await asset.uploader;
        if (!uploader) {
            throw new Error(`Uploader not found for ID: ${asset.id}`);
        }

        return {
            embeds: [{
                author: {
                    name: `${uploader.displayName}`,
                    icon_url: uploader.avatarUrl,
                    url: `${EnvConfig.server.frontendUrl}/users/${uploader.id}`
                },
                title: ` ${asset.name}`,
                url: `${EnvConfig.server.frontendUrl}/assets/${asset.id}`,
                thumbnail: asset.iconNames[0] ? { url: `${EnvConfig.server.backendUrl}/files/icons/${asset.iconNames[0]}` } : undefined,
                description: asset.description ? (asset.description.length > 2048 ? asset.description.substring(0, 1000) + "..." : asset.description) : "No description provided.",
                color: Colors.Green,
            }],
        }
    }
}
