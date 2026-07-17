import { APIMessage, ColorResolvable, Colors, EmbedBuilder, MessagePayload, WebhookClient, WebhookMessageCreateOptions } from "discord.js";
import { Asset, Game, GameVersion, GameWebhookConfig, Project, Status, ThingRequest, User, Version, WebhookLogType } from "./Database.ts";
import { EnvConfig } from "./EnvConfig.ts";
import { capitalizeWords } from "./Tools.ts";
import { Translation } from "./database/tables/Translation.ts";
import { Logger } from "./Logger.ts";

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

    public static async sendWebhookLog(gameName: string, type: WebhookLogType, isAssetWebhook: boolean, payload: Promise<string | MessagePayload | WebhookMessageCreateOptions>): Promise<APIMessage[] | undefined> {
        let webhookConfigs = this.webhookClients.get(gameName);
        if (!webhookConfigs) return;

        let results: APIMessage[] = [];
        for (let webhookConfig of webhookConfigs) {
            if (webhookConfig.types.includes(type) && webhookConfig.isAssetWebhook === isAssetWebhook) {
                try {
                    let res = await webhookConfig.client.send(await payload);
                    Logger.info(`Sent webhook log of type ${type} to ${webhookConfig.url} for game ${gameName}`);
                    results.push(res);
                } catch (error) {
                    Logger.error(`Failed to send webhook to ${webhookConfig.url}: ${error}`);
                }
            }
        }
        return results;
    }
    // #endregion

}

export class WebhookPayloadGenerator {
    // for all status updates. WebhookLogType.StatusUpdate
    public static async generateInternalStatusUpdateEmbedPayload(thing: Asset | Project | Version, userPreformingAction: User, oldStatus: Status, newStatus: Status, reason: string): Promise<WebhookMessageCreateOptions> {
        let parentIfVersion = thing instanceof Version ? (await thing.project) as Project : null;
        let color: ColorResolvable = 0x000; // Default to black
        switch (newStatus) {
            case Status.Verified:
                color = Colors.Green;
                break;
            case Status.Removed:
                color = Colors.Red;
                break;
            case Status.Testing:
            case Status.Queue:
                color = Colors.Yellow;
                break;
            default:
                color = Colors.Grey;
        }

        let type = thing instanceof Asset ? 'asset' : 'project';
        let thingIconUrl = thing instanceof Version ? parentIfVersion?.iconUrl : thing.iconUrl;

        let payload: WebhookMessageCreateOptions = {
            embeds: [{
                author: {
                    name: `${userPreformingAction.displayName} (ID# ${userPreformingAction.id})`,
                    icon_url: userPreformingAction.avatarUrl,
                    url: `${EnvConfig.server.frontendUrl}/users/${userPreformingAction.id}`
                },
                title: `${capitalizeWords(type)} Status Updated`,
                url: `${EnvConfig.server.frontendUrl}/${thing}s/${thing.id}`,
                thumbnail: { url: thingIconUrl as string },
                description: `The status of the ${type} **${thing instanceof Version ? parentIfVersion?.name : thing.name}** (ID: ${thing.id}) has been updated from **${oldStatus}** to **${newStatus}**.\n\n**Reason:**\n${reason}`,
                color: color,
                footer: {
                    text: `${capitalizeWords(type)} ID: ${thing.id}`
                },
            }],
        };

        return payload;
    }

    // for Newly Verified and Newly Unverified webhooks.
    public static async generateNewlyVerifiedThingEmbedPayload(thing: Asset | Project | Version, verifiedBy: User): Promise<WebhookMessageCreateOptions> {
        let thingType = thing instanceof Asset ? 'asset' : thing instanceof Project ? 'project' : 'version';
        let thingTypeUrl = thing instanceof Version ? `projects` : `${thingType}s`;
        let uploader = thing instanceof Project ? thing.authors && thing.authors.length > 0 ? thing.authors[0] : new Error(`Couldn't find author`) : await thing.uploader as User;
        let title = thing instanceof Version ? (await thing.project as Project).name + " v" + thing.semver.raw : thing.name;
        let description = thing instanceof Version ? (await thing.project as Project).summary : thing.description ? (thing.description.length > 512 ? thing.description.substring(0, 500) + "..." : thing.description) : "No description provided.";
        let icon = thing instanceof Version ? (await thing.project as Project).iconUrl : thing.iconUrl;

        if (uploader instanceof Error) {
            throw uploader;
        }

        let color: ColorResolvable = thing.status === Status.Verified ?  Colors.Green : Colors.Yellow;

        return {
            embeds: [{
                author: {
                    name: `${uploader.displayName} `,
                    icon_url: uploader.avatarUrl,
                    url: `${EnvConfig.server.frontendUrl}/${thingTypeUrl}/${uploader.id}`
                },
                title: `${title} `,
                url: `${EnvConfig.server.frontendUrl}/${thingTypeUrl}/${thing.id}`,
                thumbnail: { url: icon },
                description,
                color,
                footer: {
                    text: `${capitalizeWords(thingType)} ID: ${thing.id} | Approved by: ${verifiedBy.displayName} | Status: ${capitalizeWords(thing.status)}`
                },
            }],
        }
    }

    // for newly created assets and projects. WebhookLogType.NewThing 
    public static async generateCreatedNewThingEmbedPayload(thing: Asset | Project): Promise<WebhookMessageCreateOptions> {
        let type = thing instanceof Asset ? 'asset' : 'project';
        let author = (thing instanceof Asset ? thing.uploader : (thing.authors && thing.authors.length > 0 ? thing.authors[0] : null)) as User | null;

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

    // for newly created versions. WebhookLogType.NewSubThing
    public static async generateNewProjectVersionEmbedPayload(version: Version): Promise<WebhookMessageCreateOptions> {
        let project = await version.project as Project;
        let author = await version.uploader as User;

        let depNames = await Project.findAll({
            where: {
                id: version.dependencies.map(d => d.pId)
            }
        })

        let gameVersions = version.supportedGameVersions.map(gv => gv.version).join(", ");

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

    // for new reports. WebhookLogType.NewReport
    public static async generateNewReportEmbedPayload(request: ThingRequest, thing: Asset | Project | User | Version, reporter: User, firstMessage: string): Promise<WebhookMessageCreateOptions> {
        let thingType: string;
        if (thing instanceof Asset) thingType = 'asset';
        else if (thing instanceof Project) thingType = 'project';
        else if (thing instanceof User) thingType = 'user';
        else if (thing instanceof Version) thingType = 'version';
        else thingType = 'thing';

        let firstMessagePreview = firstMessage.length > 512 ? firstMessage.substring(0, 500) + "..." : firstMessage;

        return {
            embeds: [{
                author: {
                    name: `${reporter.displayName} (ID# ${reporter.id})`,
                    icon_url: reporter.avatarUrl,
                    url: `${EnvConfig.server.frontendUrl}/users/${reporter.id}`
                },
                title: `New Report for ${capitalizeWords(thingType)}: ${thing instanceof Version ? (await thing.project as Project).name + " v" + thing.semver.raw : thing instanceof User ? thing.displayName : thing.name}`,
                url: `${EnvConfig.server.frontendUrl}/requests/${request.id}`,
                thumbnail: { url: thing instanceof Version ? (await thing.project as Project).iconUrl : thing instanceof User ? thing.avatarUrl : thing.iconUrl },
                description: `A new report has been submitted for the ${thingType} **${thing instanceof Version ? (await thing.project as Project).name + " v" + thing.semver.raw : thing instanceof User ? thing.displayName : thing.name}** (ID: ${thing instanceof Version ? thing.projectId : thing.id}).\n\n**First message:**\n${firstMessagePreview}`,
                color: Colors.Orange,
                footer: {
                    text: `${capitalizeWords(thingType)} ID: ${thing instanceof Version ? thing.projectId : thing.id} | Report ID: ${request.id}`
                },
                timestamp: new Date(request.createdAt).toISOString(),
            }],
        }
    }

    // for translation out of date logs. WebhookLogType.Text_TranslationOutOfDate
    public static async generateTranslationOutOfDateWebhookPayload(translation: Translation, thing: Asset | Project): Promise<WebhookMessageCreateOptions> {
        let thingType = thing instanceof Asset ? 'asset' : 'project';
        return {
            content: `The ${translation.language} translation of ${thingType} **[${thing.name}](${EnvConfig.server.frontendUrl}/${thingType}s/${thing.id})'s ${translation.contentType}** (ID: ${thing.id}) has been marked as out of date and in need of review.`,
        }
    }

    // for edited thing logs. WebhookLogType.Text_Edited
    public static async generateEditedThingPayload(thing: Version | Translation | GameVersion, editor: User, parentId: number): Promise<WebhookMessageCreateOptions>;
    public static async generateEditedThingPayload(thing: Asset | Project | Game, editor: User, parentId?: number): Promise<WebhookMessageCreateOptions>;
    public static async generateEditedThingPayload(thing: Asset | Project | Version | Translation | GameVersion | Game, editor: User, parentId?: number): Promise<WebhookMessageCreateOptions> {
        let thingType: string;
        if (thing instanceof Asset) thingType = 'asset';
        else if (thing instanceof Project) thingType = 'project';
        else if (thing instanceof Version) thingType = 'version';
        else if (thing instanceof Translation) thingType = 'translation';
        else if (thing instanceof GameVersion) thingType = 'game version';
        else if (thing instanceof Game) thingType = 'game';
        else thingType = 'thing';

        if (thing instanceof Translation) {
            return {
                content: `The ${thing.language} Translation for [${thing.parentId}](${EnvConfig.server.frontendUrl}/${thingType.replace(" ", "-")}s/${thing.parentId})'s **${thing.contentType}** (ID: ${thing.parentId}) has been edited by **[${editor.displayName}](${EnvConfig.server.frontendUrl}/users/${editor.id})** (ID# **${editor.id}**).`,
            }
        }

        if (thing instanceof Version) {
            return {
                content: `Version **[${(await thing.project)?.name} ${thing.semver.raw}](${EnvConfig.server.frontendUrl}/projects/${parentId})** has been edited by **[${editor.displayName}](${EnvConfig.server.frontendUrl}/users/${editor.id})** (ID# **${editor.id}**).`,
            }
        }

        if (thing instanceof GameVersion || thing instanceof Game) {
            let name = thing instanceof GameVersion ? thing.gameName : thing.name;

            return {
                content: `**${capitalizeWords(thingType)} **${name}${thing instanceof GameVersion ? ` ${thing.version}` : ``}** has been edited by **[${editor.displayName}](${EnvConfig.server.frontendUrl}/users/${editor.id})** (ID# **${editor.id}**).`,
            }
        }

        return {
            content: `**${capitalizeWords(thingType)} [${thing.name}](${EnvConfig.server.frontendUrl}/${thingType}s/${thing.id})** has been edited by **[${editor.displayName}](${editor.displayName}](${EnvConfig.server.frontendUrl}/users/${editor.id}) (ID# ${editor.id})**.`,
        }
    }

    public static async generateStatusPayload(thing: Asset | Project | Version, userPreformingAction: User, oldStatus: Status, newStatus: Status, reason: string): Promise<WebhookMessageCreateOptions> {
        let thingType: string;
        if (thing instanceof Asset) thingType = 'asset';
        else if (thing instanceof Project) thingType = 'project';
        else if (thing instanceof Version) thingType = 'version';
        else thingType = 'thing';
        
        return {
            content: `The status of ${capitalizeWords(thingType)} **[${thing instanceof Version ? (await thing.project)?.name + " v" + thing.semver.raw : thing.name}](${EnvConfig.server.frontendUrl}/${thing instanceof Version ? `project` : thingType}s/${thing.id})** has been updated from **${oldStatus}** to **${newStatus}** by **[${userPreformingAction.displayName}](${EnvConfig.server.frontendUrl}/users/${userPreformingAction.id})** (ID# ${userPreformingAction.id}).\n**Reason:**\n${reason}`,
        }
    }
}
