import { DataTypes } from "sequelize";
import { Migration, Status } from "../../Database.ts";

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
            type: DataTypes.JSONB,
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
    await queryInterface.createTable(`assets`, {
        id: {
            type: DataTypes.INTEGER,
            primaryKey: true,
            allowNull: false,
            autoIncrement: true,
            unique: true
        },
        oldId: {
            type: DataTypes.STRING,
            allowNull: true,
            unique: true,
        },
        linkedIds: {
            type: DataTypes.JSON,
            allowNull: false,
            defaultValue: [],
        },
        type: {
            type: DataTypes.STRING,
            allowNull: false,
        },
        uploaderId: {
            type: DataTypes.STRING,
            allowNull: false
        },
        credits: {
            type: DataTypes.JSONB,
            allowNull: false,
            defaultValue: []
        },
        name: {
            type: DataTypes.STRING,
            allowNull: false
        },
        description: {
            type: DataTypes.TEXT,
            allowNull: true
        },
        license: {
            type: DataTypes.STRING,
            allowNull: false
        },
        licenseUrl: {
            type: DataTypes.STRING,
            allowNull: true
        },
        sourceUrl: {
            type: DataTypes.STRING,
            allowNull: true
        },
        fileHash: {
            type: DataTypes.STRING,
            allowNull: false,
            unique: true
        },
        fileSize: {
            type: DataTypes.INTEGER,
            allowNull: false
        },
        iconNames: {
            type: DataTypes.JSONB,
            allowNull: false,
            defaultValue: []
        },
        status: {
            type: DataTypes.STRING,
            allowNull: false,
            defaultValue: Status.Private,
        },
        statusHistory: {
            type: DataTypes.JSONB,
            allowNull: false,
            defaultValue: []
        },
        tags: {
            type: DataTypes.JSONB,
            allowNull: false,
            defaultValue: []
        },
        createdAt: DataTypes.DATE,
        updatedAt: DataTypes.DATE,
        deletedAt: DataTypes.DATE
    });
    await queryInterface.createTable(`alerts`, {
        id: {
            type: DataTypes.INTEGER,
            primaryKey: true,
            autoIncrement: true,
            allowNull: false
        },
        type: {
            type: DataTypes.STRING,
            allowNull: false,
        },
        userId: {
            type: DataTypes.STRING,
            allowNull: false,
        },
        assetId: {
            type: DataTypes.INTEGER,
            allowNull: true,
        },
        requestId: {
            type: DataTypes.INTEGER,
            allowNull: true,
        },
        header: {
            type: DataTypes.STRING,
            allowNull: false,
        },
        message: {
            type: DataTypes.STRING,
            allowNull: false,
        },
        read: {
            type: DataTypes.BOOLEAN,
            allowNull: false,
            defaultValue: false
        },
        discordMessageSent: {
            type: DataTypes.BOOLEAN,
            allowNull: false,
            defaultValue: false
        },
        createdAt: DataTypes.DATE,
        updatedAt: DataTypes.DATE,
        deletedAt: DataTypes.DATE
    });
    await queryInterface.createTable(`asset_requests`, {
        id: {
            type: DataTypes.INTEGER,
            primaryKey: true,
            autoIncrement: true,
            allowNull: false
        },
        refrencedAsset: {
            type: DataTypes.INTEGER,
            allowNull: false
        },
        requesterId: {
            type: DataTypes.STRING,
            allowNull: false
        },
        requestResponseBy: {
            type: DataTypes.STRING,
            allowNull: true
        },
        requestType: {
            type: DataTypes.STRING,
            allowNull: false,
        },
        reason: {
            type: DataTypes.STRING,
            allowNull: false
        },
        accepted: {
            type: DataTypes.BOOLEAN,
            allowNull: true,
            defaultValue: null
        },
        acceptReason: {
            type: DataTypes.STRING,
            allowNull: true,
            defaultValue: null
        },
        createdAt: DataTypes.DATE,
        updatedAt: DataTypes.DATE,
        deletedAt: DataTypes.DATE,
    });
}

export const down: Migration = async ({ context: db }) => {
    await db.sequelize.getQueryInterface().dropAllTables();
}