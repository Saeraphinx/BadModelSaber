import { InferAttributes, InferCreationAttributes, CreationOptional, NonAttribute, WhereOptions, Op } from "sequelize";
import { AllowNull, BelongsToMany, Column, CreatedAt, DataType, Default, DeletedAt, Model, Sequelize, Table, UpdatedAt } from "sequelize-typescript";
import { GameVersionApiV2, GameVersionApiV3, GameVersionApiV3_full } from "../DBExtras.ts";
import { Version } from "./Version.ts";
import { VersionGameVersion } from "./Junctions.ts";
import { parseErrorMessage } from "../../Tools.ts";
import { coerce } from "semver";

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
        defaultValue: Sequelize.literal(`nextval('global_id_seq')`),
    })
    declare readonly id: CreationOptional<number>;

    @AllowNull(false)
    @Column(DataType.STRING)
    declare gameName: string;

    @AllowNull(false)
    @Column(DataType.STRING)
    declare version: string; // semver-esc version (e.g. 1.29.1)

    @AllowNull(false)
    @Default(false)
    @Column(DataType.BOOLEAN)
    declare defaultVersion: CreationOptional<boolean>;

    @AllowNull(false)
    @Default([])
    @Column(DataType.ARRAY(DataType.INTEGER))
    declare linkedVersionIds: CreationOptional<number[]>;

    @AllowNull(true)
    @Default(null)
    @Column(DataType.STRING)
    declare groupName: CreationOptional<string | null>;

    @BelongsToMany(() => Version, () => VersionGameVersion)
    declare versions: NonAttribute<Version[]>;

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
            include: [{
                model: GameVersion,
                where: { id: gv1.id },
                through: { attributes: [] },
                required: true, // inner join
            }],
        });

        let gv2Versions = await Version.findAll({
            include: [{
                model: GameVersion,
                where: { id: gv2.id },
                through: { attributes: [] },
                required: true, // inner join
            }],
        });

        // add gv2 id to all versions that have gv1 id, and vice versa
        for (let version of gv1Versions) {
            if (!version.$has(`supportedGameVersions`, gv2)) {
                version.$add(`supportedGameVersions`, gv2);
                await version.save();
            }
        }

        for (let version of gv2Versions) {
            if (!version.$has(`supportedGameVersions`, gv1)) {
                version.$add(`supportedGameVersions`, gv1);
                await version.save();
            }
        }
        return { gv1, gv2 };
    }

    public async setDefault() {
        await GameVersion.update({ defaultVersion: false }, {
            where: {
                gameName: this.gameName,
                id: {
                    [Op.ne]: this.id,
                },
            },
        }).then(async () => {
            this.defaultVersion = true;
            return await this.save();
        });
    }


    public static compare(a: GameVersion, b: GameVersion): number {
        if (a.gameName < b.gameName) {
            return -1;
        } else if (a.gameName > b.gameName) {
            return 1;
        } else {
            // if game names are the same, sort by version using semver
            const aSV = coerce(a.version, { loose: true });
            const bSV = coerce(b.version, { loose: true });
            if (!aSV || !bSV) {
                // if either version can't be coerced, sort by version string
                if (a.version < b.version) {
                    return -1;
                } else if (a.version > b.version) {
                    return 1;
                } else {
                    return 0;
                }
            } else {
                return aSV.compare(bSV);
            }
        }
    }

    public static compareDecending(a: GameVersion, b: GameVersion): number {
        return GameVersion.compare(b, a);
    }

    public toApiV3(): GameVersionApiV3 {
        return {
            id: this.id as number,
            gameName: this.gameName,
            version: this.version,
        };
    }

    public toApiV3_full(): GameVersionApiV3_full {
        return {
            id: this.id as number,
            gameName: this.gameName,
            version: this.version,
            defaultVersion: this.defaultVersion,
            linkedVersionIds: this.linkedVersionIds || [],
            groupName: this.groupName || null,
            createdAt: this.createdAt,
            updatedAt: this.updatedAt,
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