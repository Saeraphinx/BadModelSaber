import { InferAttributes, InferCreationAttributes, CreationOptional, WhereOptions, Op } from "sequelize";
import { AllowNull, Column, CreatedAt, DataType, Default, DeletedAt, Model, Sequelize, Table, UpdatedAt } from "sequelize-typescript";
import { GameVersionApiV2 } from "../DBExtras.ts";
import { Version } from "./Version.ts";

export type GameVersionInfer = InferAttributes<GameVersion>;
export type GameVersionWhereOptions = WhereOptions<GameVersion>;
@Table({
    tableName: `game_versions`,
    modelName: `GameVersion`,
    timestamps: true,
    paranoid: true,
})
export class GameVersion extends Model<InferAttributes<GameVersion>, InferCreationAttributes<GameVersion>> {
    @Column({
        type: DataType.INTEGER,
        allowNull: false,
        primaryKey: true,
        autoIncrement: true,
        autoIncrementIdentity: true,
        defaultValue: Sequelize.fn(`nextval`, Sequelize.literal(`'global_id_seq'`)),
    })
    declare readonly id: CreationOptional<number>;

    @AllowNull(false)
    @Column(DataType.TEXT)
    declare gameName: string;

    @AllowNull(false)
    @Column(DataType.TEXT)
    declare version: string; // semver-esc version (e.g. 1.29.1)

    @AllowNull(false)
    @Default(false)
    @Column(DataType.BOOLEAN)
    declare defaultVersion: CreationOptional<boolean>;

    @AllowNull(false)
    @Default([])
    @Column(DataType.ARRAY(DataType.INTEGER))
    declare linkedVersionIds: CreationOptional<number[]>;

    @CreatedAt
    declare readonly createdAt: CreationOptional<Date>;
    @UpdatedAt
    declare readonly updatedAt: CreationOptional<Date>;
    @DeletedAt
    declare readonly deletedAt: CreationOptional<Date> | null;

    public static async linkedVersionIdsUpdate(id1: number, id2: number) {
        const gv1 = await GameVersion.findByPk(id1);
        const gv2 = await GameVersion.findByPk(id2);
        if (!gv1 || !gv2) {
            throw new Error('One or both GameVersions not found');
        }
    
        // make sure that the ids are actually linked
        if (!gv1.linkedVersionIds?.includes(gv2.id)) {
            gv1.linkedVersionIds = [...(gv1.linkedVersionIds || []), gv2.id];
            await gv1.save();
        }
        if (!gv2.linkedVersionIds?.includes(gv1.id)) {
            gv2.linkedVersionIds = [...(gv2.linkedVersionIds || []), gv1.id];
            await gv2.save();
        }

        // find all versions that have gv1 id or gv2 id in their supportedGameVersionIds
        let gv1Versions = await Version.findAll({
            where: {
                supportedGameVersionIds: {
                    [Op.contains]: [gv1.id]
                }
            }
        });

        let gv2Versions = await Version.findAll({
            where: {
                supportedGameVersionIds: {
                    [Op.contains]: [gv2.id]
                }
            }
        });

        // add gv2 id to all versions that have gv1 id, and vice versa
        for (let version of gv1Versions) {
            if (!version.supportedGameVersionIds.includes(gv2.id)) {
                version.supportedGameVersionIds = [...version.supportedGameVersionIds, gv2.id];
                await version.save();
            }
        }

        for (let version of gv2Versions) {
            if (!version.supportedGameVersionIds.includes(gv1.id)) {
                version.supportedGameVersionIds = [...version.supportedGameVersionIds, gv1.id];
                await version.save();
            }
        }
        return { gv1, gv2 };
    }

    public toApiV3() {
        return {
            id: this.id,
            gameName: this.gameName,
            version: this.version,
        };
    }

    public toApiV2(): GameVersionApiV2 {
        return {
            id: this.id,
            gameName: this.gameName,
            version: this.version,
            defaultVersion: this.defaultVersion,
            createdAt: this.createdAt,
            updatedAt: this.updatedAt,
        };
    }
}