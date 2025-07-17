import { DataTypes } from "sequelize";
import { Migration } from "../../Database.ts";

/*
    Inital Database structure.
    Info on the Migration System can be found here: https://github.com/sequelize/umzug?tab=readme-ov-file#minimal-example
    
*/

export const up: Migration = async ({ context: db }) => {
    let queryInterface = db.sequelize.getQueryInterface();
    await queryInterface.createTable(`users`, {
        id: {
            type: DataTypes.STRING,
            primaryKey: true,
        },
        username: {
            type: DataTypes.STRING,
            allowNull: false,
            unique: true,
        },
        displayName: {
            type: DataTypes.STRING,
            allowNull: false,
        },
        avatarUrl: {
            type: DataTypes.STRING,
            allowNull: true,
        },
        bio: {
            type: DataTypes.TEXT,
            allowNull: true,
        },
        sponsorUrl: {
            type: DataTypes.STRING,
            allowNull: true,
        },
        roles: {
            type: DataTypes.ARRAY(DataTypes.STRING),
            allowNull: false,
            defaultValue: [],
        },
        createdAt: DataTypes.DATE,
        updatedAt: DataTypes.DATE,
        deletedAt: {
            type: DataTypes.DATE,
            allowNull: true,
        }
    });
}

export const down: Migration = async ({ context: db }) => {
    await db.sequelize.getQueryInterface().dropAllTables();
}