import { CreationOptional, InferAttributes, InferCreationAttributes } from "sequelize";
import { AfterUpdate, Column, CreatedAt, DataType, DeletedAt, Model, PrimaryKey, Table, UpdatedAt } from "sequelize-typescript";
import { WebhookPayloadGenerator, Webhooks } from "../../Webhooks.ts";
import { Project } from "./Project.ts";
import { Asset } from "./Asset.ts";
import { WebhookMessageCreateOptions } from "discord.js";
import { EnvConfig } from "../../EnvConfig.ts";
import { WebhookLogType } from "../DBExtras.ts";

@Table({
    tableName: `translations`,
    modelName: `Translation`,
    timestamps: true,
    paranoid: true,
})
export class Translation extends Model<InferAttributes<Translation>, InferCreationAttributes<Translation>> {
    // #region Columns
    @PrimaryKey
    @Column(DataType.INTEGER)
    declare parentId: number; // ID of the entity this translation belongs to (e.g. Asset, Project, etc.)

    @PrimaryKey
    @Column(DataType.STRING)
    declare contentType: `name` | `description` | `summary`; // Type of content being translated (e.g. "name", "description", etc.)

    @PrimaryKey
    @Column(DataType.STRING)
    declare language: string; // Language code (e.g. "en", "es", "fr", etc.)

    @Column(DataType.TEXT)
    declare translatedString: string; // The actual translated text

    @Column(DataType.TEXT)
    declare originalString: string; // The original text before translation

    @Column(DataType.BOOLEAN)
    declare outOfDate: boolean; // Indicates whether the translation may be out of date and in need of review

    @Column(DataType.INTEGER)
    declare translatedBy: number; // User ID of the translator

    @UpdatedAt
    declare updatedAt: CreationOptional<Date>;
    @CreatedAt
    declare createdAt: CreationOptional<Date>;
    @DeletedAt
    declare deletedAt: CreationOptional<Date | null>;
    // #endregion

    public async markOutOfDate(thing: Project | Asset) {
        if (!this.outOfDate) {
            this.outOfDate = true;
            await this.save();
            if (thing instanceof Asset) {
                Webhooks.sendWebhookLog(thing.gameName, WebhookLogType.Text_TranslationOutOfDate, true, WebhookPayloadGenerator.generateTranslationOutOfDateWebhookPayload(this, thing));
            } else {
                Webhooks.sendWebhookLog(thing.gameName, WebhookLogType.Text_TranslationOutOfDate, false, WebhookPayloadGenerator.generateTranslationOutOfDateWebhookPayload(this, thing));
            }
        }
    }
}
