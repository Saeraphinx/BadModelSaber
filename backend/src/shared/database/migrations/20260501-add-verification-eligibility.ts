import { DataTypes, ModelAttributes } from "sequelize";
import { Migration } from "../../Database.ts";

export const up: Migration = async ({ context: db }) => {
    const queryInterface = db.sequelize.getQueryInterface();

    await queryInterface.addColumn(`versions`, `eligbleForVerification`, {
        type: DataTypes.BOOLEAN,
        allowNull: false,
        defaultValue: true,
    });
};

export const down: Migration = async ({ context: db }) => {
    const queryInterface = db.sequelize.getQueryInterface();

    await queryInterface.removeColumn(`versions`, `eligbleForVerification`);
};