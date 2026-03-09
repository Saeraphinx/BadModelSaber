import { DataTypes, ModelAttributes } from "sequelize";
import { Migration, Status } from "../../Database.ts";

/*
    Inital Database structure.
    Info on the Migration System can be found here: https://github.com/sequelize/umzug?tab=readme-ov-file#minimal-example
    
*/

export const up: Migration = async ({ context: db }) => {
    const queryInterface = db.sequelize.getQueryInterface();

}

export const down: Migration = async ({ context: db }) => {
    await db.sequelize.getQueryInterface().dropAllTables();
}