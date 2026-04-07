import { APIMessage, ColorResolvable, Colors, EmbedBuilder, MessagePayload, WebhookClient, WebhookMessageCreateOptions } from "discord.js";
import { Asset, Game, GameVersion, GameWebhookConfig, Project, Status, User, Version, WebhookLogType } from "./Database.ts";
import { EnvConfig } from "./EnvConfig.ts";
import { capitalizeWords } from "./Tools.ts";

/* 

This file contains all logic related to managing and sending webhooks, including generating payloads for different types of webhook logs. It interfaces with the Game table to retrieve webhook configurations and send the payloads.

Each webhook log type can be turned on and off for each game, and can be designated as an "asset webhook" or not. 

*/

const userUrl = `${EnvConfig.server.frontendUrl}/user/`;
type GameWebhookConfigWithClient = GameWebhookConfig & { client: WebhookClient };
export class Webhooks {
    private static webhookClients: Map<string, GameWebhookConfigWithClient[]> = new Map();


    // #region Webhook Management
    public static testWebhook(url: string): boolean {
        try {
            let testClient = new WebhookClient({ url: url });
            return true;
        } catch (error) {
            return false;
        }
    }

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
    // for status update
    public static generateInternalStatusUpdateEmbedPayload(thing: Asset | Project, userPreformingAction: User, oldStatus: Status, newStatus: Status): WebhookMessageCreateOptions {
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

        let type = thing instanceof Asset ? 'asset' : 'project';
        let thingIconUrl = thing.iconUrl;

        let payload: WebhookMessageCreateOptions = {
            embeds: [{
                author: {
                    name: `${userPreformingAction.displayName} (ID# ${userPreformingAction.id})`,
                    icon_url: userPreformingAction.avatarUrl,
                    url: `${EnvConfig.server.frontendUrl}/users/${userPreformingAction.id}`
                },
                title: `${capitalizeWords(type)} Status Updated`,
                url: `${EnvConfig.server.frontendUrl}/${thing}s/${thing.id}`,
                thumbnail: { url: thing.iconUrl},
                description: `The status of the ${type} **${thing.name}** (ID: ${thing.id}) has been updated from **${oldStatus}** to **${newStatus}**.`,
                color: color,
                footer: {
                    text: `${capitalizeWords(type)} ID: ${thing.id}`
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

    public static async generateCreatedNewThingEmbedPayload(thing: Asset | Project): Promise<WebhookMessageCreateOptions> {
        let type = thing instanceof Asset ? 'asset' : 'project';
        let author = (thing instanceof Asset ? thing.uploader : thing.authorIds.length > 0 ? (await User.findByPk(thing.authorIds[0])) : null) as User | null;

        let payload: WebhookMessageCreateOptions = {
            embeds: [{
                author: {
                    name: `${author?.displayName} (ID# ${author?.id})`,
                    icon_url: author?.avatarUrl,
                    url: `${EnvConfig.server.frontendUrl}/users/${author?.id}`
                },
                title: `New ${capitalizeWords(type)} Created: ${thing.name}`,
                url: `${EnvConfig.server.frontendUrl}/${type}s/${thing.id}`,
                thumbnail: { url: thing.iconUrl },
                description: `A new ${type} named **${thing.name}** has been created by ${author?.displayName}.`,
                color: Colors.Blue,
                footer: {
                    text: `${capitalizeWords(type)} ID: ${thing.id}`
                },
            }],
        };

        return payload;
    }

    public static async generateNewProjectVersionEmbedPayload(version: Version): Promise<WebhookMessageCreateOptions> {
        let project = await version.project as Project;
        let author = await version.uploader as User;

        let depNames = await Project.findAll({
            where: {
                id: version.dependencies.map(d => d.pId)
            }
        })

        let gameVersions = await GameVersion.findAll({
            where: {
                id: version.supportedGameVersionIds
            }
        }).then(gvs => gvs.map(gv => gv.version)).then(vers => vers.join(", "));

        let payload: WebhookMessageCreateOptions = {
            embeds: [{
                author: {
                    name: `${author.displayName} (ID# ${author.id})`,
                    icon_url: author.avatarUrl,
                    url: `${EnvConfig.server.frontendUrl}/users/${author.id}`
                },
                title: `New Version Uploaded for ${project.name}: ${version.semver.raw}`,
                url: `${EnvConfig.server.frontendUrl}/projects/${project.id}/versions/${version.id}`,
                thumbnail: { url: project.iconUrl },
                description: `A new version (**${version.semver.raw}**) has been uploaded for the project **${project.name}** by ${author.displayName}.`,
                color: Colors.Purple,
                fields: [
                    {
                        name: "Dependencies",
                        value: version.dependencies.length > 0 ? version.dependencies.map(dep => `**${depNames.find(p => p.id == dep.pId)?.name}**@${dep.sv}`).join(", ") : "None",
                    },
                    {
                        name: "# of Files",
                        value: version.contentHashes.length.toString(),
                    },
                    {
                        name: "Supported Game Versions",
                        value: gameVersions,
                    }
                ],
                footer: {
                    text: `Project ID: ${project.id} | Version ID: ${version.id}`
                },
                timestamp: new Date(version.createdAt).toISOString(),
            }],
        };

        return payload;
    }
}
