import { DataTypes } from "sequelize";
import { Migration } from "../../Database.ts";

export const up: Migration = async ({ context: db }) => {
    const queryInterface = db.sequelize.getQueryInterface();

    await queryInterface.createTable(`version_game_versions`, {
        versionId: {
            type: DataTypes.INTEGER,
            allowNull: false,
            primaryKey: true,
            references: {
                model: `versions`,
                key: `id`,
            },
            onDelete: `CASCADE`,
            onUpdate: `CASCADE`,
        },
        gameVersionId: {
            type: DataTypes.INTEGER,
            allowNull: false,
            primaryKey: true,
            references: {
                model: `game_versions`,
                key: `id`,
            },
            onDelete: `CASCADE`,
            onUpdate: `CASCADE`,
        },
    });

    await db.sequelize.query(`
        INSERT INTO "version_game_versions" ("versionId", "gameVersionId")
        SELECT DISTINCT v."id", gv_id
        FROM "versions" v
        CROSS JOIN LATERAL unnest(v."supportedGameVersionIds") AS gv_id
        ON CONFLICT ("versionId", "gameVersionId") DO NOTHING;
    `);
};

export const down: Migration = async ({ context: db }) => {
    await db.sequelize.getQueryInterface().dropTable(`version_game_versions`);
};
