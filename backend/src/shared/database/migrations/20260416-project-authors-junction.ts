import { DataTypes } from "sequelize";
import { Migration } from "../../Database.ts";

export const up: Migration = async ({ context: db }) => {
    const queryInterface = db.sequelize.getQueryInterface();

    await queryInterface.createTable(`project_authors`, {
        projectId: {
            type: DataTypes.INTEGER,
            allowNull: false,
            primaryKey: true,
            references: {
                model: `projects`,
                key: `id`,
            },
            onDelete: `CASCADE`,
            onUpdate: `CASCADE`,
        },
        userId: {
            type: DataTypes.INTEGER,
            allowNull: false,
            primaryKey: true,
            references: {
                model: `users`,
                key: `id`,
            },
            onDelete: `CASCADE`,
            onUpdate: `CASCADE`,
        },
    });

    await db.sequelize.query(`
        INSERT INTO "project_authors" ("projectId", "userId")
        SELECT DISTINCT p."id", author_id
        FROM "projects" p
        CROSS JOIN LATERAL unnest(p."authorIds") AS author_id
        ON CONFLICT ("projectId", "userId") DO NOTHING;
    `);
};

export const down: Migration = async ({ context: db }) => {
    await db.sequelize.getQueryInterface().dropTable(`project_authors`);
};
