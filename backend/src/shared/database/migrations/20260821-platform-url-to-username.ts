import { QueryTypes } from "sequelize";
import { Migration } from "../../Database.ts";

export const up: Migration = async ({ context: db }) => {
    const queryInterface = db.sequelize.getQueryInterface();

    const users = await queryInterface.sequelize.query<{ id: number; userPlatforms: { url: string, platform: string }[]  }>(
        `SELECT id, "userPlatforms" FROM users`,
        { type: QueryTypes.SELECT }
    );

    for (const user of users) {
        let migratedPlatforms: { platform: string; username: string }[] = [];
        if (Array.isArray(user.userPlatforms)) {
            migratedPlatforms = user.userPlatforms.map((plat) => {
                return {
                    platform: plat.platform,
                    username: plat.url.split(`/`).pop() ?? null,
                };
            }).filter((plat) => plat.username !== null) as { platform: string; username: string }[];
        }

        const escapedPlatforms = queryInterface.sequelize.escape(JSON.stringify(migratedPlatforms));

        await queryInterface.sequelize.query(
            `UPDATE users SET "userPlatforms" = ${escapedPlatforms}::jsonb WHERE id = :id`,
            {
                replacements: { id: user.id },
                type: QueryTypes.UPDATE,
            }
        );
    }
};

export const down: Migration = async ({ context: db }) => {
    // Not reversible: original full URL values are discarded once converted to usernames.
    const queryInterface = db.sequelize.getQueryInterface();
    await queryInterface.sequelize.query(
        `UPDATE users SET "userPlatforms" = '[]'::jsonb`,
        { type: QueryTypes.UPDATE }
    );
};