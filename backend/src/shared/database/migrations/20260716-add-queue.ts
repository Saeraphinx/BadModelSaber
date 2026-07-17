import { DataTypes, ModelAttributes } from "sequelize";
import { AssetFileFormat, Migration } from "../../Database.ts";

export const up: Migration = async ({ context: db }) => {
    const queryInterface = db.sequelize.getQueryInterface();

    await queryInterface.addColumn(`versions`, `testingAutoVerifyTime`, {
        type: DataTypes.STRING,
        allowNull: true,
        defaultValue: null,
    },);

    await queryInterface.removeColumn(`versions`, `eligbleForVerification`);
};

export const down: Migration = async ({ context: db }) => {
    const queryInterface = db.sequelize.getQueryInterface();

    await queryInterface.removeColumn(`versions`, `testingAutoVerifyTime`);

     await queryInterface.addColumn(`versions`, `eligbleForVerification`, {
        type: DataTypes.BOOLEAN,
        allowNull: false,
        defaultValue: true,
    });
};