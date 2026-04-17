import { Column, DataType, ForeignKey, Model, PrimaryKey, Table } from "sequelize-typescript";
import { Project } from "./Project.ts";
import { User } from "./User.ts";
import { Version } from "./Version.ts";
import { GameVersion } from "./GameVersion.ts";

@Table({
    tableName: `project_authors`,
    modelName: `ProjectAuthor`,
    timestamps: false,
})
export class ProjectAuthor extends Model<ProjectAuthor> {
    @PrimaryKey
    @ForeignKey(() => Project)
    @Column(DataType.INTEGER)
    declare projectId: number;

    @PrimaryKey
    @ForeignKey(() => User)
    @Column(DataType.INTEGER)
    declare userId: number;
}

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