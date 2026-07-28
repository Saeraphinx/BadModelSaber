import { DataTypes, ModelAttributes } from "sequelize";
import { Migration } from "../../Database.ts";

export const up: Migration = async ({ context: db }) => {
    const queryInterface = db.sequelize.getQueryInterface();

    await queryInterface.addColumn(`game_versions`, `groupName`, {
        type: DataTypes.STRING,
        allowNull: true,
        defaultValue: null,
    });
};

export const down: Migration = async ({ context: db }) => {
    const queryInterface = db.sequelize.getQueryInterface();

    await queryInterface.removeColumn(`game_versions`, `groupName`);
};