import { EnvConfig } from "./EnvConfig.ts";
import { Logger } from "./Logger.ts";
import { ModelStatic, Sequelize, DataType } from "sequelize-typescript";
import { Umzug, SequelizeStorage } from "umzug";
import { User } from "./database/tables/User.ts";
import { Asset } from "./database/tables/Asset.ts";
import { Alert } from "./database/tables/Alert.ts";
import { ThingRequest } from "./database/tables/ThingRequest.ts";
import { PlatformType, Status, UserPermissions } from "./database/DBExtras.ts";
import fs from "node:fs";
import { parseErrorMessage } from "./Tools.ts";
import { Version } from "./database/tables/Version.ts";
import { Project } from "./database/tables/Project.ts";
import { GameVersion } from "./database/tables/GameVersion.ts";
import { ProjectAuthor, VersionGameVersion } from "./database/tables/Junctions.ts";
import { Translation } from "./database/tables/Translation.ts";
import { Game } from "./database/tables/Game.ts";

export * from "./database/tables/User.ts";
export * from "./database/tables/Asset.ts";
export * from "./database/tables/Alert.ts";
export * from "./database/tables/ThingRequest.ts";
export * from "./database/DBExtras.ts";
export * from "./database/tables/Game.ts"
export * from "./database/tables/GameVersion.ts"
export * from "./database/tables/Junctions.ts"
export * from "./database/tables/Project.ts"
export * from "./database/tables/Version.ts"

export type Migration = typeof DatabaseManager.prototype.umzug._types.migration;

export class DatabaseManager {
    public sequelize: Sequelize;
    public umzug: Umzug<this>;
    public schemaName: string;
    public adminUser: User | undefined;

    constructor(useAltSchema?: string, connectionString: string = EnvConfig.database.connectionString) {
        Logger.log(`Creating DatabaseManager...`);
        if (!connectionString) {
            throw new Error(`Database connection string is not set.`);
        }
        this.schemaName = useAltSchema || `public`;
        this.schemaName = this.schemaName.toLowerCase();
        if (!/^[a-z_][a-z0-9_]*$/.test(this.schemaName)) {
            throw new Error(`Invalid schema name: ${this.schemaName}`);
        }
        Logger.log(`Using schema: ${this.schemaName}`);

        this.sequelize = new Sequelize(connectionString, {
            dialect: `postgres`,
            //logging: (msg) => fs.writeFileSync(`test.log`, msg.replaceAll(`\n`, `\\n`).replaceAll(`Executing (default): `, ``) + `\n`, { flag: `a` }),
            logging: false,
            schema: this.schemaName,
        });

        if (this.schemaName !== `public`) {
            // Keep all queries (including Umzug migrations) on the selected schema.
            this.sequelize.addHook(`afterConnect`, async (connection: any) => {
                await connection.query(`SET search_path TO "${this.schemaName}", public;`);
            });
        }

        let globPath = `./build/shared/database/migrations/*.js`;
        this.umzug = new Umzug({
            migrations: {
                glob: globPath,
            },
            storage: new SequelizeStorage({ sequelize: this.sequelize, schema: this.schemaName }),
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
            Logger.error(`Database connection failed: ${parseErrorMessage(error)}`);
            Logger.error(error)
            process.exit(1);
        });
    }

    public async closeConnenction() {
        Logger.log(`Closing database connection...`);
        return await this.sequelize.close().then(() => {
            Logger.log(`Database connection closed.`);
        }).catch((error) => {
            Logger.error(`Failed to close database connection: ${parseErrorMessage(error)}`);
            Logger.error(error)
        });
    }

    public async init() {
        Logger.log(`Initializing DatabaseManager...`);

        // initialize everything for usage. should resolve once the database is ready.
        await this.connect();
        await this.sequelize.query(`CREATE SCHEMA IF NOT EXISTS "${this.schemaName}"`);
        await this.migrate();
        this.loadTables();
        try {
            //await this.sequelize.sync();
            Logger.log(`Database loaded successfully.`);
            await this.createAdminUserIfNotExists()
            return this;
        } catch (error: any) {
            Logger.error(`Failed to sync database: ${parseErrorMessage(error)}`);
            process.exit(1);
        }
    }

    public async createAdminUserIfNotExists() {
        this.adminUser = await User.findOrCreate({
            where: { id: 5 },
            defaults: {
                id: 5,
                githubId: null,
                discordId: null,
                username: `system`,
                displayName: `System User`,
                bio: `hi :3\n\nThis user account is used for system operations and is not meant to be used by anyone.\n\nBadModelSaber is developed by [Saeraphinx](https://saeraphinx.dev) and the [Beat Saber Modding Group](https://bsmg.wiki). If you need to contact us, you can find links to our support channels on our Wiki: https://bsmg.wiki/contact-us`,
                permissions: {
                    sitewide: [...Object.values(UserPermissions).filter(r => !r.startsWith(`cos_`)), UserPermissions.C_System],
                    perGame: {}
                },
                userPlatforms: [{
                    platform: PlatformType.Patreon,
                    url: `https://www.patreon.com/beatsabermoddinggroup`
                }, {
                    platform: PlatformType.KoFi,
                    url: `https://ko-fi.com/beatsabermods`
                }],
                avatarUrl: `https://cdn.discordapp.com/embed/avatars/5.png`
            }
        }).then(([user, created]) => {
            if (created) {
                Logger.info(`Admin user created: ${user.username} (${user.id})`)
            }
            return user
        }).catch((err) => {
            Logger.error(`Error creating admin user: ${err}`)
            throw err
        });
    }

    public async createSchema(schemaName: string = this.schemaName) {
        Logger.log(`Creating schema ${schemaName}...`);
        await this.sequelize.query(`CREATE SCHEMA IF NOT EXISTS "${schemaName}"`);
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

        this.sequelize.query(`CREATE SEQUENCE IF NOT EXISTS global_id_seq INCREMENT BY 1 START WITH 1000;`);
        this.sequelize.addModels([
            User,
            Asset,
            Alert,
            ThingRequest,
            Game,
            GameVersion,
            Project,
            Version,
            Translation,
            VersionGameVersion,
            ProjectAuthor,
        ]);

        // I would do this in the table definition but it causes circular import issues, so here we are
        Project.addScope(`defaultScope`, {
            include: [{
                model: User,
                as: 'authors'
            }]
        })

        let assetCount = Asset.count();
        let userCount = User.count();
        let projectCount = Project.count();
        let versionCount = Version.count();
        Promise.all([assetCount, userCount, projectCount, versionCount]).then(async () => {
            Logger.log(`Loading tables complete. Asset count: ${await assetCount}, User count: ${await userCount}, Project count: ${await projectCount}, Version count: ${await versionCount}`);
        });
    }

    public async importFromFile(path: string = `./storage/fakeData.json`) {
        Logger.log(`Importing database from file...`);
        let data = JSON.parse(fs.readFileSync(path, `utf-8`));
        if (!data || typeof data !== `object`) {
            throw new Error(`Invalid fake data format`);
        }

        await this.import(data);
    }

    public async import(data: any) {
        Logger.log(`Importing database...`);

        let totalRows = 0;
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
            if (data[model].length != 0) {
                await table.bulkCreate(data[model], { ignoreDuplicates: true, validate: true, }).then(async () => {
                    Logger.log(`Imported ${data[model].length} rows into table ${table.name}.`);
                    if (table.getAttributes().id?.autoIncrement) {
                        await this.sequelize.query(`SELECT setval('${this.schemaName}.${table.tableName}_id_seq', ${data[model].length != 0 ? data[model].length : 1}, true);`);
                    }
                }).catch((error) => {
                    Logger.error(`Failed to import data into table ${table.name}: ${error.message}`);
                });
            } else {
                Logger.log(`No data to import for table ${table.name}. Skipping.`);
            }
            totalRows += data[model].length;
        }
        // set global_id_seq to the # of rows added
        let currentId = await this.sequelize.query(`SELECT last_value FROM global_id_seq;`).then(([results]) => {
            // @ts-ignore
            return results[0].last_value;
        }).catch((error) => {
            Logger.error(`Failed to get current value of global_id_seq: ${error.message}`);
            return 1000; // default starting value
        });

        await this.sequelize.query(`SELECT setval('global_id_seq', ${totalRows != 0 ? totalRows+currentId : 1000}, true);`);
        Logger.log(`Database import complete. Imported a total of ${totalRows} rows.`);
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