import { InferAttributes, InferCreationAttributes } from "sequelize";
import { Column, DataType, Model, PrimaryKey, Table } from "sequelize-typescript";

@Table({
    tableName: `translations`,
    modelName: `Translation`,
    timestamps: true,
    paranoid: true,
})
export class Translation extends Model<InferAttributes<Translation>, InferCreationAttributes<Translation>> {
    // #region Columns
    @Column(DataType.NUMBER)
    @PrimaryKey
    declare parentId: number; // ID of the entity this translation belongs to (e.g. Asset, Project, etc.)

    @Column(DataType.STRING)
    @PrimaryKey
    declare contentType: string; // Type of content being translated (e.g. "name", "description", etc.)

    @Column(DataType.STRING)
    @PrimaryKey
    declare language: string; // Language code (e.g. "en", "es", "fr", etc.)

    @Column(DataType.TEXT)
    declare translatedString: string; // The actual translated text

    @Column(DataType.TEXT)
    declare originalString: string; // The original text before translation

    @Column(DataType.BOOLEAN)
    declare outOfDate: boolean; // Indicates whether the translation may be out of date and in need of review

    @Column(DataType.NUMBER)
    declare translatedBy: number; // User ID of the translator
    // #endregion
}
