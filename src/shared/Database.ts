import path from "node:path";
import { EnvConfig } from "./EnvConfig.ts";
import { Logger } from "./Logger.ts";
import { ModelStatic, Sequelize, DataType, DataTypes } from "sequelize";
import { Umzug, SequelizeStorage } from "umzug";
import { User } from "./database/tables/User.ts";
import { Asset, AssetType, Status, AssetFileFormat } from "./database/tables/Asset.ts";

export * from "./database/tables/User.ts";
export * from "./database/tables/Asset.ts";

export class DatabaseManager {
    private sequelize: Sequelize;
    private umzug: Umzug<Sequelize>;

    public Users: ModelStatic<User>;
    public Assets: ModelStatic<Asset>;

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

    public init() {
        Logger.log(`Initializing DatabaseManager...`);

        this.connect();
        this.migrate();
        this.sequelize.sync().then(() => {
            Logger.log(`Database synced successfully.`);
        }).catch((error) => {
            Logger.error(`Failed to sync database: ${error.message}`);
            process.exit(1);
        });
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
    }

    public async loadHooks() {
        Logger.log(`Loading hooks...`);

        this.Assets.beforeCreate(`generateId`, (asset, options) => {
            // Set the asset ID to a unique identifier if not provided
            if (!asset.id) {
                let id = new Date().getTime();
                asset.setDataValue('id', id);
            }
        });

        this.Assets.afterValidate(`checkValidator`,(asset, options) => {
            // throws if invalid
            Asset.validator.parse(asset);
        });
    }
}