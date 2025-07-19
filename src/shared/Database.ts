import path, { parse } from "node:path";
import { EnvConfig } from "./EnvConfig.ts";
import { Logger } from "./Logger.ts";
import { ModelStatic, Sequelize, DataType, DataTypes } from "sequelize";
import { Umzug, SequelizeStorage } from "umzug";
import { User } from "./database/tables/User.ts";
import { Asset } from "./database/tables/Asset.ts";
import { Alert } from "./database/tables/Alert.ts";
import { AssetRequest } from "./database/tables/AssetRequest.ts";
import { Status } from "./database/DBExtras.ts";
import fs from "node:fs";
import { parseErrorMessage } from "./Tools.ts";

export * from "./database/tables/User.ts";
export * from "./database/tables/Asset.ts";
export * from "./database/tables/Alert.ts";
export * from "./database/tables/AssetRequest.ts";
export * from "./database/DBExtras.ts";

export type Migration = typeof DatabaseManager.prototype.umzug._types.migration;

export class DatabaseManager {
    public sequelize: Sequelize;
    public umzug: Umzug<this>;
    public schemaName: string;

    public Users: ModelStatic<User>;
    public Assets: ModelStatic<Asset>;
    public Alerts: ModelStatic<Alert>;
    public AssetRequests: ModelStatic<AssetRequest>;

    constructor(useAltSchema?: string) {
        Logger.log(`Creating DatabaseManager...`);
        if (!EnvConfig.database.connectionString) {
            throw new Error(`Database connection string is not set in environment variables.`);
        }
        this.schemaName = useAltSchema || `public`;
        this.sequelize = new Sequelize(EnvConfig.database.connectionString, {
            dialect: `postgres`,
            //logging: (msg) => fs.writeFileSync(`test.log`, msg.replaceAll(`\n`, `\\n`).replaceAll(`Executing (default): `, ``) + `\n`, { flag: `a` }),
            logging: false,
            schema: this.schemaName,
        });

        let globPath = `./build/shared/database/migrations/*.js`;
        this.umzug = new Umzug({
            migrations: {
                glob: globPath,
            },
            storage: new SequelizeStorage({sequelize: this.sequelize}),
            context: this,
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

        // initialize everything for usage. should resolve once the database is ready.
        await this.connect();
        await this.sequelize.query(`CREATE SCHEMA IF NOT EXISTS ${this.schemaName}`);
        await this.migrate();
        this.loadTables();
        this.loadHooks();
        try {
            await this.sequelize.sync();
            Logger.log(`Database synced successfully.`);
            return this;
        } catch (error: any) {
            Logger.error(`Failed to sync database: ${parseErrorMessage(error)}`);
            process.exit(1);
        }
    }

    public async dropSchema() {
        if (!this.schemaName) {
            throw new Error(`Schema name is not set. Cannot drop schema.`);
        }

        if (this.schemaName === `public`) {
            throw new Error(`Cannot drop the public schema. Please use a different schema name.`);
        }

        Logger.log(`Dropping schema ${this.schemaName}...`);
        return await this.sequelize.query(`DROP SCHEMA IF EXISTS ${this.schemaName} CASCADE`).then(() => {
            Logger.log(`Schema ${this.schemaName} dropped successfully.`);
        }).catch((error) => {
            Logger.error(`Failed to drop schema ${this.schemaName}: ${error.message}`);
            throw error;
        });
    }

    public loadTables() {
        Logger.debug(`Loading tables...`);

        this.Users = User.init({
            id: {
                type: DataTypes.STRING,
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
                type: DataTypes.TEXT,
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
                type: DataTypes.ARRAY(DataTypes.STRING),
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
            fileFormat: {
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
        }, {
            sequelize: this.sequelize,
            modelName: `Asset`,
            tableName: `assets`,
            timestamps: true,
            paranoid: true
        });

        this.Alerts = Alert.init({
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
        }, {
            sequelize: this.sequelize,
            modelName: `Alert`,
            tableName: `alerts`,
            timestamps: true,
            paranoid: true
        });

        this.AssetRequests = AssetRequest.init({
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
        }, {
            sequelize: this.sequelize,
            modelName: `AssetRequest`,
            tableName: `asset_requests`,
            timestamps: true,
        });
    }

    public loadHooks() {
        Logger.debug(`Loading hooks...`);

        this.Assets.afterValidate(`checkAssetValidator`, async (asset, options) => {
            // throws if invalid
            if (asset.isNewRecord) {
                await Asset.createValidator.parseAsync(asset);
            } else {
                await Asset.validator.parseAsync(asset);
            }
        });

        this.Alerts.afterValidate(`checkAlertValidator`, async (alert, options) => {
            // throws if invalid
            if (alert.isNewRecord) {
                await Alert.createValidator.parseAsync(alert);
            } else {
                await Alert.validator.parseAsync(alert);
            }
        });

        this.AssetRequests.afterValidate(`checkAssetRequestValidator`, async (request, options) => {
            // throws if invalid
            if (request.isNewRecord) {
                await AssetRequest.createValidator.parseAsync(request);
            } else {
                await AssetRequest.validator.parseAsync(request);
            }
        });
    }

    public async importFakeData() {
        Logger.log(`Importing database...`);
        let data = JSON.parse(fs.readFileSync(`./storage/fakeData.json`, `utf-8`));
        if (!data || typeof data !== `object`) {
            throw new Error(`Invalid fake data format`);
        }

        for (const model in data) {
            if (model.toLowerCase().includes(`sequalize`)) {
                Logger.warn(`Skipping Sequelize internal model: ${model}`);
                continue; // Skip Sequelize internal models
            }
            const table = this.sequelize.models[model];
            if (!table) {
                Logger.error(`Table ${model} does not exist in the database.`);
                continue;
            }
            await table.bulkCreate(data[model], { ignoreDuplicates: true, validate: true }).then(() => {
                Logger.log(`Imported ${data[model].length} rows into table ${table.name}.`);
            }).catch((error) => {
                Logger.error(`Failed to import data into table ${table.name}: ${error.message}`);
            });
        }
    }

    public async export() {
        let data: {
            [key: string]: any[];
        } = {};
        for (const model in this.sequelize.models) {
            const table = this.sequelize.models[model];
            await table.findAll().then((rows) => {
                console.log(`Exporting table ${table.name}:`);
                data[table.name] = rows.map(row => row.toJSON());
                console.log(`Exported ${rows.length} rows.`);
            }).catch((error) => {
                Logger.error(`Failed to export table ${table.name}: ${error.message}`);
            });   
        }
        return data;
    }
}