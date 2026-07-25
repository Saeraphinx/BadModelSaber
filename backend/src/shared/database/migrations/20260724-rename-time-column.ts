import { DataTypes } from "sequelize";
import { Migration } from "../../Database.ts";

export const up: Migration = async ({ context: db }) => {
    const queryInterface = db.sequelize.getQueryInterface();

    await queryInterface.renameColumn("versions", "testingAutoVerifyTime", "nextStatusChangeTime");
}

export const down: Migration = async ({ context: db }) => {
    const queryInterface = db.sequelize.getQueryInterface();

    await queryInterface.renameColumn("versions", "nextStatusChangeTime", "testingAutoVerifyTime");
}