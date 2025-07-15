import path from "node:path";
import { EnvConfig } from "./EnvConfig.ts";
import { Logger } from "./Logger.ts";
import { ModelStatic, Sequelize, DataType, DataTypes } from "sequelize";
import { Umzug, SequelizeStorage } from "umzug";
import { User } from "./database/tables/User.ts";
import { Asset, AssetType, Status, AssetFileFormat } from "./database/tables/Asset.ts";
import { Alert } from "./database/tables/Alert.ts";
import { AssetRequest } from "./database/tables/AssetRequest.ts";

export * from "./database/tables/User.ts";
export * from "./database/tables/Asset.ts";
export * from "./database/tables/Alert.ts";
export * from "./database/tables/AssetRequest.ts";
export * from "./database/DBExtras.ts";

export class DatabaseManager {
    private sequelize: Sequelize;
    private umzug: Umzug<Sequelize>;

    public Users: ModelStatic<User>;
    public Assets: ModelStatic<Asset>;
    public Alerts: ModelStatic<Alert>;
    public AssetRequests: ModelStatic<AssetRequest>;

    constructor(overridePath?: string) {
        Logger.log(`Creating DatabaseManager...`);

        let storagePath:string|undefined = undefined;
        if (EnvConfig.database.dialect === `sqlite`) {
            if (EnvConfig.database.connectionString !== `:memory:`) {
                storagePath = path.resolve(EnvConfig.storage.sqlite_db);
            } else {
                storagePath = `:memory:`;
            }
        }

        if (EnvConfig.database.dialect === `sqlite`) {
            Logger.log(`Using SQLite database at ${storagePath}`);
            this.sequelize = new Sequelize({
                dialect: EnvConfig.database.dialect,
                storage: overridePath ? overridePath : storagePath,
            });
        } else if (EnvConfig.database.dialect === `postgres`) {
            Logger.log(`Using PostgreSQL database`);
            this.sequelize = new Sequelize(EnvConfig.database.connectionString, {
                dialect: EnvConfig.database.dialect,
            });
        } else {
            process.exit(1); // unsupported database dialect
        }

        this.umzug = new Umzug({
            migrations: {
                glob: `./build/shared/migrations/*.js`, // have to use the built versions because the source is not present in the final build
            },
            storage: new SequelizeStorage({sequelize: this.sequelize}),
            context: this.sequelize,
            logger: Logger
        });
    }

    public async migrate() {
        Logger.log(`Running migrations...`);
        return await this.umzug.up().then((migrations) => {
            Logger.log(`Migrations complete. Ran ${migrations.length} migrations.`);
            migrations.length != 0 ? Logger.log(`Migraions ran: ${migrations.map((migration) => migration.name).join(`, `)}`) : null;
            return migrations;
        });
    }

    public async connect() {
        Logger.log(`Connecting to database...`);
        return await this.sequelize.authenticate().then(() => {
            Logger.log(`Database connection successful.`);
        }).catch((error) => {
            Logger.error(`Database connection failed: ${error.message}`);
            process.exit(1);
        });
    }

    public async closeConnenction() {
        Logger.log(`Closing database connection...`);
        return await this.sequelize.close().then(() => {
            Logger.log(`Database connection closed.`);
        }).catch((error) => {
            Logger.error(`Failed to close database connection: ${error.message}`);
        });
    }

    public async init() {
        Logger.log(`Initializing DatabaseManager...`);

        await this.connect();
        await this.migrate();
        this.loadTables();
        this.loadHooks();
        try {
            await this.sequelize.sync();
            Logger.log(`Database synced successfully.`);
            return this;
        } catch (error: any) {
            Logger.error(`Failed to sync database: ${error.message}`);
            process.exit(1);
        }
    }

    public loadTables() {
        Logger.log(`Loading tables...`);

        this.Users = User.init({
            id: {
                type: DataTypes.NUMBER,
                primaryKey: true,
                allowNull: false,
                unique: true
            },
            username: {
                type: DataTypes.STRING,
                allowNull: false,
            },
            displayName: {
                type: DataTypes.STRING,
                allowNull: false,
                defaultValue: ``
            },
            bio: {
                type: DataTypes.STRING,
                allowNull: false,
                defaultValue: ``
            },
            sponsorUrl: {
                type: DataTypes.STRING,
                allowNull: true
            },
            avatarUrl: {
                type: DataTypes.STRING,
                allowNull: false,
                defaultValue: `https://cdn.discordapp.com/embed/avatars/0.png`
            },
            roles: {
                type: DataTypes.JSON,
                allowNull: false,
                defaultValue: []
            },
            createdAt: DataTypes.DATE,
            updatedAt: DataTypes.DATE,
            deletedAt: DataTypes.DATE
        }, {
            sequelize: this.sequelize,
            modelName: `User`,
            tableName: `users`,
            timestamps: true,
            paranoid: true
        });
        
        this.Assets = Asset.init({
            id: {
                type: DataTypes.NUMBER,
                primaryKey: true,
                allowNull: false,
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
                validate: {
                    isArray: true,
                }
            },
            type: {
                type: DataTypes.STRING,
                allowNull: false,
                validate: {
                    isIn: [Object.values(AssetType)]
                }
            },
            fileFormat: {
                type: DataTypes.STRING,
                allowNull: false,
                validate: {
                    isIn: [Object.values(AssetFileFormat)]
                }
            },
            uploaderId: {
                type: DataTypes.STRING,
                allowNull: false
            },
            credits: {
                type: DataTypes.JSON,
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
                type: DataTypes.JSON,
                allowNull: false,
                defaultValue: []
            },
            status: {
                type: DataTypes.STRING,
                allowNull: false,
                defaultValue: Status.Private,
                validate: {
                    isIn: [Object.values(Status)]
                }
            },
            statusHistory: {
                type: DataTypes.JSON,
                allowNull: false,
                defaultValue: []
            },
            tags: {
                type: DataTypes.JSON,
                allowNull: false,
                defaultValue: []
            },
            createdAt: DataTypes.DATE,
            updatedAt: DataTypes.DATE,
            deletedAt: DataTypes.DATE
        }, {
            sequelize: this.sequelize,
            modelName: `Asset`,
            tableName: `assets`,
            timestamps: true,
            paranoid: true
        });

        this.Alerts = Alert.init({
            id: {
                type: DataTypes.NUMBER,
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
                type: DataTypes.NUMBER,
                allowNull: true,
            },
            requestId: {
                type: DataTypes.NUMBER,
                allowNull: true,
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
        }, {
            sequelize: this.sequelize,
            modelName: `Alert`,
            tableName: `alerts`,
            timestamps: true,
            paranoid: true
        });

        this.AssetRequests = AssetRequest.init({
            id: {
                type: DataTypes.NUMBER,
                primaryKey: true,
                autoIncrement: true,
                allowNull: false
            },
            refrencedAsset: {
                type: DataTypes.NUMBER,
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
            createdAt: DataTypes.DATE,
            updatedAt: DataTypes.DATE,
            deletedAt: DataTypes.DATE
        }, {
            sequelize: this.sequelize,
            modelName: `AssetRequest`,
            tableName: `asset_requests`,
            timestamps: true,
        });
    }

    public loadHooks() {
        Logger.log(`Loading hooks...`);

        this.Assets.beforeCreate(`generateId`, (asset, options) => {
            // Set the asset ID to a unique identifier if not provided
            if (!asset.id) {
                let id = new Date().getTime();
                asset.setDataValue('id', id);
            }
        });

        this.Assets.afterValidate(`checkAssetValidator`, async (asset, options) => {
            // throws if invalid
            await Asset.validator.parseAsync(asset);
        });

        this.Alerts.afterValidate(`checkAlertValidator`, async (alert, options) => {
            // throws if invalid
            await Alert.validator.parseAsync(alert);
        });

        this.AssetRequests.afterValidate(`checkAssetRequestValidator`, async (request, options) => {
            // throws if invalid
            await AssetRequest.validator.parseAsync(request);
        });
    }
}