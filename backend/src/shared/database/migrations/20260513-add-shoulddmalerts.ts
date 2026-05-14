import { DataTypes, ModelAttributes } from "sequelize";
import { AssetFileFormat, Migration } from "../../Database.ts";

export const up: Migration = async ({ context: db }) => {
    const queryInterface = db.sequelize.getQueryInterface();

    await queryInterface.addColumn(`users`, `shouldDmAlerts`, {
        type: DataTypes.STRING,
        allowNull: false,
        defaultValue: false,
    },);
};

export const down: Migration = async ({ context: db }) => {
    const queryInterface = db.sequelize.getQueryInterface();

    await queryInterface.removeColumn(`assets`, `shouldDmAlerts`);
};