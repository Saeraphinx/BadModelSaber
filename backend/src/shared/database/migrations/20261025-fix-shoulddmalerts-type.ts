import { DataTypes } from "sequelize";
import { Migration } from "../../Database.ts";

export const up: Migration = async ({ context: db }) => {
    const qi = db.sequelize.getQueryInterface();
    await qi.addColumn(`users`, `shouldDmAlerts_new`, {
        type: DataTypes.BOOLEAN,
        allowNull: false,
        defaultValue: false,
    });
    await qi.bulkUpdate(`users`, { shouldDmAlerts_new: true }, { shouldDmAlerts: `true` });
    await qi.removeColumn(`users`, `shouldDmAlerts`);
    await qi.renameColumn(`users`, `shouldDmAlerts_new`, `shouldDmAlerts`);
};

export const down: Migration = async ({ context: db }) => {
    const qi = db.sequelize.getQueryInterface();

    await qi.changeColumn(`users`, `shouldDmAlerts`, {
        type: DataTypes.STRING,
        allowNull: false,
        defaultValue: false,
    });
};