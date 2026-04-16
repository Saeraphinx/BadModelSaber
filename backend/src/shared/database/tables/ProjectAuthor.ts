import { Column, DataType, ForeignKey, Model, PrimaryKey, Table } from "sequelize-typescript";
import { Project } from "./Project.ts";
import { User } from "./User.ts";

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
