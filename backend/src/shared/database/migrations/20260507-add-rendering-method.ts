import { DataTypes, ModelAttributes } from "sequelize";
import { AssetFileFormat, Migration } from "../../Database.ts";

export const up: Migration = async ({ context: db }) => {
    const queryInterface = db.sequelize.getQueryInterface();

    await queryInterface.addColumn(`assets`, `renderingMethod`, {
        type: DataTypes.STRING,
        allowNull: true,
        defaultValue: null,

    },);

    // get all assets and set the rendering method based on the asset's type
    let typesToSetAsBIRP = [
        `saber_saber`, // AssetFileFormat.Saber_Saber,
        `platform_plat`, // AssetFileFormat.Platform_Plat,
        `note_bloq`, // AssetFileFormat.Note_Bloq,
        `avatar_avatar`, // AssetFileFormat.Avatar_Avatar,
        `note_cyoob`, // AssetFileFormat.Note_Cyoob,
        `saber_whacker`, // AssetFileFormat.Saber_Whacker,
        `wall_pixie`, // AssetFileFormat.Wall_Pixie,
        `wall_box` // AssetFileFormat.Wall_Box
    ];
    await db.sequelize.query(`UPDATE assets SET "renderingMethod" = 'birp_sp' WHERE type IN (${typesToSetAsBIRP.map(type => `'${type}'`).join(', ')})`);
};

export const down: Migration = async ({ context: db }) => {
    const queryInterface = db.sequelize.getQueryInterface();

    await queryInterface.removeColumn(`assets`, `renderingMethod`);
};