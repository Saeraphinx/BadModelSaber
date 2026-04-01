import { DataTypes, ModelAttributes } from "sequelize";
import { Migration, Status } from "../../Database.ts";

/*
    Inital Database structure.
    Info on the Migration System can be found here: https://github.com/sequelize/umzug?tab=readme-ov-file#minimal-example
    
*/

export const up: Migration = async ({ context: db }) => {
    const queryInterface = db.sequelize.getQueryInterface();

    await db.sequelize.query(`CREATE SEQUENCE IF NOT EXISTS global_id_seq INCREMENT BY 1 START WITH 10;`);


    // user goes first since theres a lot linking to this table
    // #region users
    await queryInterface.createTable(`users`, {
        id: {
            type: DataTypes.INTEGER,
            allowNull: false,
            primaryKey: true,
            defaultValue: db.sequelize.literal(`nextval('global_id_seq')`),
        },
        discordId: {
            type: DataTypes.STRING(32),
            allowNull: true,
            unique: true,
        },
        githubId: {
            type: DataTypes.STRING(32),
            allowNull: true,
            unique: true,
        },
        username: {
            type: DataTypes.STRING,
            allowNull: false,
        },
        displayName: {
            type: DataTypes.STRING,
            allowNull: false,
            defaultValue: "",
        },
        bio: {
            type: DataTypes.TEXT,
            allowNull: false,
            defaultValue: "",
        },
        userPlatforms: {
            type: DataTypes.JSONB,
            allowNull: true,
            defaultValue: [],
        },
        avatarUrl: {
            type: DataTypes.STRING,
            allowNull: false,
            defaultValue: "https://cdn.discordapp.com/embed/avatars/0.png",
        },
        permissions: {
            type: DataTypes.JSONB,
            allowNull: false,
            defaultValue: { sitewide: [], perGame: {} },
        },
        createdAt: {
            type: DataTypes.DATE,
            allowNull: false,
            defaultValue: DataTypes.NOW,
        },
        updatedAt: {
            type: DataTypes.DATE,
            allowNull: false,
            defaultValue: DataTypes.NOW,
        },
        deletedAt: {
            type: DataTypes.DATE,
            allowNull: true,
        }
    });
    // #endregion
     
    // create all tables based on the models
    // #region alerts  
    await queryInterface.createTable(`alerts`, {
        id: {
            type: DataTypes.INTEGER,
            allowNull: false,
            primaryKey: true,
            autoIncrement: true,
        },
        type: {
            type: DataTypes.STRING,
            allowNull: false,
        },
        userId: {
            type: DataTypes.INTEGER,
            allowNull: false,
        },
        assetId: {
            type: DataTypes.INTEGER,
            allowNull: true,
            defaultValue: null,
        },
        projectId: {
            type: DataTypes.INTEGER,
            allowNull: true,
            defaultValue: null,
        },
        versionId: {
            type: DataTypes.INTEGER,
            allowNull: true,
            defaultValue: null,
        },
        requestId: {
            type: DataTypes.INTEGER,
            allowNull: true,
            defaultValue: null,
        },
        header: {
            type: DataTypes.STRING,
            allowNull: false,
        },
        message: {
            type: DataTypes.TEXT,
            allowNull: false,
        },
        read: {
            type: DataTypes.BOOLEAN,
            allowNull: false,
            defaultValue: false,
        },
        discordMessageSent: {
            type: DataTypes.BOOLEAN,
            allowNull: false,
            defaultValue: false,
        },
        createdAt: {
            type: DataTypes.DATE,
            allowNull: false,
            defaultValue: DataTypes.NOW,
        },
        updatedAt: {
            type: DataTypes.DATE,
            allowNull: false,
            defaultValue: DataTypes.NOW
        }
    });
    // #endregion

    // uses global id
    await queryInterface.createTable(`assets`, {
        id: {
            type: DataTypes.INTEGER,
            allowNull: false,
            primaryKey: true,
            defaultValue: db.sequelize.literal(`nextval('global_id_seq')`),
        },
        oldId: {
            type: DataTypes.INTEGER,
            allowNull: true,
            unique: true,
        },
        linkedIds: {
            type: DataTypes.ARRAY(DataTypes.JSONB),
            allowNull: false,
            defaultValue: [],
        },
        type: {
            type: DataTypes.STRING,
            allowNull: false,
        },
        // foreign key, blongs to users table
        uploaderId: {
            type: DataTypes.INTEGER,
            allowNull: false,
            references: {
                model: 'users',
                key: 'id',
            },
            onDelete: 'RESTRICT',
            onUpdate: 'CASCADE',
        },
        collaboratorIds: {
            type: DataTypes.ARRAY(DataTypes.INTEGER),
            allowNull: false,
            defaultValue: [],
        },
        name: {
            type: DataTypes.TEXT,
            allowNull: false,
        },
        description: {
            type: DataTypes.TEXT,
            allowNull: false,
        },
        license: {
            type: DataTypes.STRING,
            allowNull: false,
        },
        licenseUrl: {
            type: DataTypes.STRING,
            allowNull: true,
            defaultValue: null,
        },
        sourceUrl: {
            type: DataTypes.STRING,
            allowNull: true,
            defaultValue: null,
        },
        fileSafeName: {
            type: DataTypes.STRING,
            allowNull: false,
        },
        fileHash: {
            type: DataTypes.STRING,
            allowNull: false,
            unique: true,
        },
        fileSize: {
            type: DataTypes.INTEGER,
            allowNull: false,
        },
        iconNames: {
            type: DataTypes.ARRAY(DataTypes.STRING),
            allowNull: false,
            defaultValue: [],
        },
        status: {
            type: DataTypes.STRING,
            allowNull: false,
            defaultValue: `private`,
        },
        statusHistory: {
            type: DataTypes.JSONB,
            allowNull: false,
            defaultValue: [],
        },
        tags: {
            type: DataTypes.ARRAY(DataTypes.STRING),
            allowNull: false,
            defaultValue: [],
        },
        gameName: {
            type: DataTypes.STRING,
            allowNull: false,
        },
        createdAt: {
            type: DataTypes.DATE,
            allowNull: false,
            defaultValue: DataTypes.NOW,
        },
        updatedAt: {
            type: DataTypes.DATE,
            allowNull: false,
            defaultValue: DataTypes.NOW,
        },
        deletedAt: {
            type: DataTypes.DATE,
            allowNull: true,
            defaultValue: null,
        }
    });

    await queryInterface.createTable(`games`, {
        name: {
            type: DataTypes.STRING,
            allowNull: false,
            primaryKey: true,
        },
        displayName: {
            type: DataTypes.TEXT,
            allowNull: false,
        },
        categories: {
            type: DataTypes.ARRAY(DataTypes.TEXT),
            allowNull: false,
            defaultValue: [`Core`, `Essentials`, `Other`],
        },
        platforms: {
            type: DataTypes.ARRAY(DataTypes.TEXT),
            allowNull: false,
            defaultValue: [`universal`],
        },
        webhookConfig: {
            type: DataTypes.ARRAY(DataTypes.JSONB),
            allowNull: false,
            defaultValue: [],
        },
        default: {
            type: DataTypes.BOOLEAN,
            allowNull: false,
            defaultValue: false,
        },
        createdAt: {
            type: DataTypes.DATE,
            allowNull: false,
            defaultValue: DataTypes.NOW,
        },
        updatedAt: {
            type: DataTypes.DATE,
            allowNull: false,
            defaultValue: DataTypes.NOW
        },
        deletedAt: {
            type: DataTypes.DATE,
            allowNull: true,
            defaultValue: null,
        }
    });

    // uses global id
    await queryInterface.createTable(`game_versions`, {
        id: {
            type: DataTypes.INTEGER,
            allowNull: false,
            primaryKey: true,
            defaultValue: db.sequelize.literal(`nextval('global_id_seq')`),
        },
        gameName: {
            type: DataTypes.STRING,
            allowNull: false,
        },
        version: {
            type: DataTypes.STRING,
            allowNull: false,
        },
        defaultVersion: {
            type: DataTypes.BOOLEAN,
            allowNull: false,
            defaultValue: false,
        },
        linkedVersionIds: {
            type: DataTypes.ARRAY(DataTypes.INTEGER),
            allowNull: false,
            defaultValue: [],
        },
        createdAt: {
            type: DataTypes.DATE,
            allowNull: false,
            defaultValue: DataTypes.NOW,
        },
        updatedAt: {
            type: DataTypes.DATE,
            allowNull: false,
            defaultValue: DataTypes.NOW
        },
        deletedAt: {
            type: DataTypes.DATE,
            allowNull: true,
            defaultValue: null,
        }
    });

    // using global id
    await queryInterface.createTable(`projects`, {
        id: {
            type: DataTypes.INTEGER,
            allowNull: false,
            primaryKey: true,
            defaultValue: db.sequelize.literal(`nextval('global_id_seq')`),
        },
        nameId: {
            type: DataTypes.STRING,
            allowNull: false,
        },
        name: {
            type: DataTypes.STRING,
            allowNull: false,
        },
        summary: {
            type: DataTypes.TEXT,
            allowNull: false,
        },
        description: {
            type: DataTypes.TEXT,
            allowNull: false,
        },
        // foreign key for game, references games table
        gameName: {
            type: DataTypes.STRING,
            allowNull: false,
            references: {
                model: 'games',
                key: 'name',
            },
            onDelete: 'RESTRICT',
            onUpdate: 'CASCADE',
        },
        category: {
            type: DataTypes.STRING,
            allowNull: false,
        },
        authorIds: {
            type: DataTypes.ARRAY(DataTypes.INTEGER),
            allowNull: false,
            defaultValue: [],
        },
        collaboratorIds: {
            type: DataTypes.ARRAY(DataTypes.INTEGER),
            allowNull: false,
            defaultValue: [],
        },
        status: {
            type: DataTypes.STRING,
            defaultValue: `private`,
            allowNull: false,
        },
        iconFileName: {
            type: DataTypes.STRING,
            allowNull: false,
        },
        gitUrl: {
            type: DataTypes.TEXT,
            allowNull: false,
        },
        statusHistory: {
            type: DataTypes.ARRAY(DataTypes.JSONB),
            allowNull: false,
            defaultValue: [],
        },
        lastApprovedById: {
            type: DataTypes.INTEGER,
            allowNull: true,
            defaultValue: null,
        },
        lastUpdatedById: {
            type: DataTypes.INTEGER,
            allowNull: true,
            defaultValue: null,
        },
        createdAt: {
            type: DataTypes.DATE,
            allowNull: false,
            defaultValue: DataTypes.NOW,
        },
        updatedAt: {
            type: DataTypes.DATE,
            allowNull: false,
            defaultValue: DataTypes.NOW
        },
        deletedAt: {
            type: DataTypes.DATE,
            allowNull: true,
            defaultValue: null,
        }
    });

    // using global id
    await queryInterface.createTable(`versions`, {
        id: {
            type: DataTypes.INTEGER,
            allowNull: false,
            primaryKey: true,
            defaultValue: db.sequelize.literal(`nextval('global_id_seq')`),
        },
        projectId: {
            type: DataTypes.INTEGER,
            allowNull: false,
            references: {
                model: 'projects',
                key: 'id',
            },
            onDelete: 'CASCADE',
            onUpdate: 'CASCADE',
        },
        uploaderId: {
            type: DataTypes.INTEGER,
            allowNull: false,
            references: {
                model: 'users',
                key: 'id',
            },
            onDelete: 'RESTRICT',
            onUpdate: 'CASCADE',
        },
        semver: {
            type: DataTypes.STRING,
            allowNull: false,
        },
        supportedGameVersionIds: {
            type: DataTypes.ARRAY(DataTypes.INTEGER),
            allowNull: false,
            defaultValue: [],
        },
        status: {
            type: DataTypes.STRING,
            defaultValue: `private`,
            allowNull: false,
        },
        dependencies: {
            type: DataTypes.ARRAY(DataTypes.JSONB),
            allowNull: false,
            defaultValue: [],
        },
        platform: {
            type: DataTypes.STRING,
            allowNull: false,
        },
        zipHash: {
            type: DataTypes.STRING,
            allowNull: false,
        },
        contentHashes: {
            type: DataTypes.ARRAY(DataTypes.JSONB),
            allowNull: false,
            defaultValue: [],
        },
        lastApprovedById: {
            type: DataTypes.INTEGER,
            allowNull: true,
            defaultValue: null,
        },
        lastUpdatedById: {
            type: DataTypes.INTEGER,
            allowNull: false,
        },
        fileSize: {
            type: DataTypes.INTEGER,
            allowNull: false,
        },
        statusHistory: {
            type: DataTypes.ARRAY(DataTypes.JSONB),
            allowNull: false,
            defaultValue: [],
        },
        createdAt: {
            type: DataTypes.DATE,
            allowNull: false,
            defaultValue: DataTypes.NOW,
        },
        updatedAt: {
            type: DataTypes.DATE,
            allowNull: false,
            defaultValue: DataTypes.NOW
        },
        deletedAt: {
            type: DataTypes.DATE,
            allowNull: true,
            defaultValue: null,
        }
    });

    await queryInterface.createTable(`thing_requests`, {
        id: {
            type: DataTypes.INTEGER,
            allowNull: false,
            primaryKey: true,
            autoIncrement: true
        },
        refrencedId: {
            type: DataTypes.INTEGER,
            allowNull: true,
        },
        refrencedGameName: {
            type: DataTypes.STRING,
            allowNull: true,
        },
        requesterId: {
            type: DataTypes.INTEGER,
            allowNull: false,
            references: {
                model: 'users',
                key: 'id',
            },
            onDelete: 'RESTRICT',
            onUpdate: 'CASCADE',
        },
        requestResponseBy: {
            type: DataTypes.INTEGER,
            allowNull: true,
            defaultValue: null,
        },
        objectToAdd: {
            type: DataTypes.JSONB,
            allowNull: true,
            defaultValue: null,
        },
        requestType: {
            type: DataTypes.STRING,
            allowNull: false,
        },
        accepted: {
            type: DataTypes.BOOLEAN,
            allowNull: true,
            defaultValue: null,
        },
        resolvedBy: {
            type: DataTypes.INTEGER,
            allowNull: true,
            defaultValue: null,
        },
        messages: {
            type: DataTypes.ARRAY(DataTypes.JSONB),
            allowNull: false,
            defaultValue: [],
        },
        createdAt: {
            type: DataTypes.DATE,
            allowNull: false,
            defaultValue: DataTypes.NOW,
        },
        updatedAt: {
            type: DataTypes.DATE,
            allowNull: false,
            defaultValue: DataTypes.NOW
        },
        deletedAt: {
            type: DataTypes.DATE,
            allowNull: true,
            defaultValue: null,
        }
    });

    await queryInterface.createTable(`translations`, {
        parentId: {
            type: DataTypes.INTEGER,
            allowNull: false,
            primaryKey: true,
        },
        contentType: {
            type: DataTypes.STRING,
            allowNull: false,
            primaryKey: true,
        },
        language: {
            type: DataTypes.STRING,
            allowNull: false,
            primaryKey: true,
        },
        translatedString: {
            type: DataTypes.TEXT,
            allowNull: false,
        },
        originalString: {
            type: DataTypes.TEXT,
            allowNull: false,
        },
        outOfDate: {
            type: DataTypes.BOOLEAN,
            allowNull: false,
            defaultValue: false,
        },
        translatedBy: {
            type: DataTypes.INTEGER,
            allowNull: false,
        },
        createdAt: {
            type: DataTypes.DATE,
            allowNull: false,
            defaultValue: DataTypes.NOW,
        },
        updatedAt: {
            type: DataTypes.DATE,
            allowNull: false,
            defaultValue: DataTypes.NOW,
        },
        deletedAt: {
            type: DataTypes.DATE,
            allowNull: true,
            defaultValue: null,
        }
    });

}

export const down: Migration = async ({ context: db }) => {
    await db.sequelize.getQueryInterface().dropAllTables();
}