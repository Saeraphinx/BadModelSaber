import { Column, DataType, ForeignKey, Model, PrimaryKey, Table } from "sequelize-typescript";
import { Version } from "./Version.ts";
import { GameVersion } from "./GameVersion.ts";

@Table({
    tableName: `version_game_versions`,
    modelName: `VersionGameVersion`,
    timestamps: false,
})
export class VersionGameVersion extends Model<VersionGameVersion> {
    @PrimaryKey
    @ForeignKey(() => Version)
    @Column(DataType.INTEGER)
    declare versionId: number;

    @PrimaryKey
    @ForeignKey(() => GameVersion)
    @Column(DataType.INTEGER)
    declare gameVersionId: number;
}