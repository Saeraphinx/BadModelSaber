import { DataTypes } from "sequelize";
import { Migration } from "../../Database.ts";

export const up: Migration = async ({ context: db }) => {
    const queryInterface = db.sequelize.getQueryInterface();

    await queryInterface.addColumn(`users`, `hideGithubId`, {
        type: DataTypes.BOOLEAN,
        allowNull: false,
        defaultValue: false,
    });

    await queryInterface.addColumn(`users`, `hideDiscordId`, {
        type: DataTypes.BOOLEAN,
        allowNull: false,
        defaultValue: false,
    });
};

export const down: Migration = async ({ context: db }) => {
    const queryInterface = db.sequelize.getQueryInterface();

    await queryInterface.removeColumn(`users`, `hideGithubId`);

    await queryInterface.removeColumn(`users`, `hideDiscordId`);
};