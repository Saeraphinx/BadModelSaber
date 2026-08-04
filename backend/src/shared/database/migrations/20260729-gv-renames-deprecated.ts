import { DataTypes, ModelAttributes } from "sequelize";
import { Migration } from "../../Database.ts";

export const up: Migration = async ({ context: db }) => {
    const queryInterface = db.sequelize.getQueryInterface();

    await queryInterface.renameColumn("game_versions", "defaultVersion", "isDefault");

    await queryInterface.addColumn(`game_versions`, `isDeprecated`, {
        type: DataTypes.BOOLEAN,
        allowNull: false,
        defaultValue: false,
    });
};

export const down: Migration = async ({ context: db }) => {
    const queryInterface = db.sequelize.getQueryInterface();

    await queryInterface.removeColumn(`game_versions`, `isDeprecated`);

    await queryInterface.renameColumn("game_versions", "isDefault", "defaultVersion");
};