import { CreationOptional, InferAttributes, InferCreationAttributes, NonAttribute } from "sequelize";
import { AllowNull, Column, CreatedAt, DataType, Default, DeletedAt, Model, PrimaryKey, Table, UpdatedAt } from "sequelize-typescript";
import { WebhookLogType } from "../DBExtras.ts";
import { createRandomString } from "../../Tools.ts";
import { APIMessage, MessagePayload, WebhookMessageCreateOptions } from "discord.js";
import { Webhooks } from "../../Webhooks.ts";
import z from "zod/v4";


export type GameWebhookConfig = {
    id: string;
    url: string;
    isAssetWebhook: boolean
    types: WebhookLogType[];
};

export type GameInfer = InferAttributes<Game>;
@Table({
    tableName: `games`,
    modelName: `Game`,
    timestamps: true,
    paranoid: true,
})
export class Game extends Model<InferAttributes<Game>, InferCreationAttributes<Game>> {
    private static _defaultGame: NonAttribute<Game>;
    private static readonly _defaultCategories: NonAttribute<string[]> = [`Core`, `Essentials`, `Other`];
    private static readonly _defaultPlatforms: NonAttribute<string[]> = [`universal`];

    @AllowNull(false)
    @PrimaryKey
    @Column(DataType.TEXT)
    declare name: string;

    @AllowNull(false)
    @Column(DataType.TEXT)
    declare displayName: string;

    @AllowNull(false)
    @Default(Game._defaultCategories)
    @Column(DataType.ARRAY(DataType.TEXT))
    declare categories: CreationOptional<string[]>;

    @AllowNull(false)
    @Default(Game._defaultPlatforms)
    @Column(DataType.ARRAY(DataType.TEXT))
    declare platforms: CreationOptional<string[]>;

    @AllowNull(false)
    @Default([])
    @Column(DataType.ARRAY(DataType.JSONB))
    declare webhookConfig: GameWebhookConfig[];

    @AllowNull(false)
    @Default(false)
    @Column(DataType.BOOLEAN)
    declare default: boolean;

    @CreatedAt
    declare createdAt: CreationOptional<Date>;
    @UpdatedAt
    declare updatedAt: CreationOptional<Date>;
    @DeletedAt
    declare deletedAt: CreationOptional<Date | null>;

    public static get defaultGame(): NonAttribute<Promise<Game>> {
        if (!this._defaultGame) {
            return this.findOne({ where: { default: true } }).then((game) => {
                if (!game) {
                    throw new Error(`No default game set in database.`);
                } else {
                    this._defaultGame = game;
                    return game;
                }
            });
        }
        return Promise.resolve(this._defaultGame);
    }

    public static set defaultGame(game: Game) {
        if (game.default) {
            this._defaultGame = game;
        } else {
            throw new Error(`Cannot set default game to a non-default game.`);
        }
    }

    // #region Categories
    public async addCategory(category: string): Promise<Game> {
        let newCategories = this.categories ? [...this.categories] : Game._defaultCategories;

        if (category === `Core` || category === `Essentials` || category === `Other`) {
            throw new Error(`Cannot remove required categories: Core, Essentials, or Other.`);
        }

        if (newCategories.includes(category)) {
            throw new Error(`Category ${category} already exists.`);
        }

        let last = newCategories.pop();
        newCategories.push(category);
        if (last) {
            newCategories.push(last);
        }

        return await this.update({
            categories: newCategories
        });
    }

    public async removeCategory(category: string): Promise<Game> {
        let newCategories = this.categories ? [...this.categories] : Game._defaultCategories;

        if (category === `Core` || category === `Essentials` || category === `Other`) {
            throw new Error(`Cannot remove required categories: Core, Essentials, or Other.`);
        }

        if (!newCategories.includes(category)) {
            throw new Error(`Category ${category} does not exist.`);
        }

        newCategories = newCategories.filter((c) => c !== category);
        return await this.update({
            categories: newCategories
        });
    }

    public async setCategories(categories: string[]): Promise<Game> {
        let noReqdCats = categories.filter((c) => c !== `Core` && c !== `Essentials` && c !== `Other`);
        let newCategories = [`Core`, `Essentials`, ...noReqdCats, `Other`];
        return await this.update({
            categories: newCategories
        });
    }
    // #endregion

    // #region Webhooks
    /** Add a Webhook to this games config */
    public async addWebhook(webhook: Omit<GameWebhookConfig, `id`>): Promise<{ game: Game, webhook: GameWebhookConfig }> {
        let newWebhooks = this.webhookConfig ? [...this.webhookConfig] : []; // you have to make a new array if youre saving stuff to the db

        if (!newWebhooks.some((w) => webhook.url === w.url)) {
            let id = this.generateWebhookId();
            newWebhooks.push({
                id: id,
                url: webhook.url,
                isAssetWebhook: webhook.isAssetWebhook,
                types: webhook.types
            });
            let updatedGame = await this.update({ webhookConfig: newWebhooks }).then((game) => {
                Webhooks.registerWebhook(game);
                return game;
            });
            return { game: updatedGame, webhook: { id, ...webhook } };
        } else {
            throw new Error(`Webhook with URL ${webhook.url} already exists.`);
        }
    }

    /** Remove a webhook from this game's config */
    public async removeWebhook(webhookId: string): Promise<Game> {
        if (this.webhookConfig) {
            let newWebhooks = this.webhookConfig.filter((w) => w.id !== webhookId);
            return await this.update({ webhookConfig: newWebhooks }).then((game) => {
                Webhooks.registerWebhook(game);
                return game;
            });
        }
        throw new Error(`Webhook with ID ${webhookId} does not exist.`);
    }

    /** Set the full webhook config to the game's config */
    public async setWebhook(webhookId: string, webhook: Omit<GameWebhookConfig, `id`>): Promise<Game> {
        let newWebhooks = this.webhookConfig ? [...this.webhookConfig] : [];

        let oldWebhook = newWebhooks.find((w) => w.id === webhookId);
        if (oldWebhook) {
            newWebhooks.splice(newWebhooks.indexOf(oldWebhook), 1, {
                id: webhookId,
                url: webhook.url,
                isAssetWebhook: webhook.isAssetWebhook,
                types: webhook.types
            });
            return await this.update({ webhookConfig: newWebhooks }).then((game) => {
                Webhooks.registerWebhook(game);
                return game;
            });
        } else {
            throw new Error(`Webhook with ID ${webhookId} does not exist.`);
        }
    }

    /** Get an API-safe versions of the game webhooks */
    public getAPIWebhooks(): GameWebhookConfig[] {
        if (!this.webhookConfig) {
            this.webhookConfig = [];
        }


        return this.webhookConfig.map((w) => {
            let halfLength = w.url.length / 2;

            return {
                id: w.id,
                url: `${w.url.length > 4 ? w.url.slice(0, halfLength) : ``}${`*`.repeat(halfLength)}`,
                types: w.types,
                isAssetWebhook: w.isAssetWebhook
            };
        });
    }

    /** Generate a random internal ID for later refrence */
    private generateWebhookId(): string {
        let id = createRandomString(8);
        while (this.webhookConfig?.some((w) => w.id === id)) {
            id = createRandomString(8);
        }
        return id;
    }

    /** Send a payload to each of the available webhooks for this game */
    public sendToWebhooks(logType: WebhookLogType, isAssetWebhook: boolean, payload: string | MessagePayload | WebhookMessageCreateOptions): Promise<APIMessage[] | undefined> {
        return Webhooks.sendWebhookLog(this.name, logType, isAssetWebhook, payload);
    }
    // #endregion

    public toApiV3() {
        return {
            name: this.name,
            displayName: this.displayName,
            categories: this.categories,
            platforms: this.platforms,
            webhooks: this.getAPIWebhooks(),
            default: this.default,
        };
    }
}