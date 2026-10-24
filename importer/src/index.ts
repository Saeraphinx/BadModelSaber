
import { AlertType, DatabaseManager, User } from '../../backend/src/shared/Database.ts';
import { EnvConfig } from '../../backend/src/shared/EnvConfig.ts';
import { Logger } from '../../backend/src/shared/Logger.ts';
import fs from 'fs';
//import { importAssetsFromBMSImport, importFromBadBeatMods } from './Importer.ts';
import {Op} from 'sequelize';

async function main() {
    EnvConfig.load();
    Logger.init();
    const db = new DatabaseManager();
    await db.init();

    //await importFromBadBeatMods();

    //await importAssetsFromBMSImport();

    // User.findAll({
    //     where: {
    //         discordId: {
    //             [Op.ne]: null
    //         }
    //     }
    // }).then(async users => {
    //     for (const user of users) {
    //         await user.createAlert({
    //             type: AlertType.Generic,
    //             header: `Account Imported`,
    //             message: `Hi ${user.displayName}! Your account has been imported from the old ModelSaber. If you notice any of your assets missing, please contact us and we will try to add them back to your profile.`,
    //         }, false);
    //     }
    // });


    const dbExport = await db.export()
    fs.writeFileSync(`export.json`, JSON.stringify(dbExport, null, 0));
}
main();