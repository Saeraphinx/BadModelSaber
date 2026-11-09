import { CreationOptional, InferAttributes, InferCreationAttributes } from "sequelize";
import { AllowNull, Column, CreatedAt, DataType, Model, PrimaryKey, Table, UpdatedAt } from "sequelize-typescript";
import { createRandomString, parseErrorMessage } from "../../Tools.ts";
import { createHash, timingSafeEqual } from "crypto";
import { EnvConfig } from "../../EnvConfig.ts";
import { Logger } from "../../Logger.ts";

@Table({
    tableName: "keys",
    modelName: "keys",
    timestamps: true,
})
export class Keys extends Model<InferAttributes<Keys>, InferCreationAttributes<Keys>> {
    @PrimaryKey
    @AllowNull(false)
    @Column(DataType.CHAR(43))
    declare key: string;

    @AllowNull(false)
    @Column(DataType.INTEGER)
    declare userId: number;

    @AllowNull(false)
    @Column(DataType.STRING)
    declare name: string;

    @CreatedAt
    declare createdAt: CreationOptional<Date>;
    @UpdatedAt
    declare updatedAt: CreationOptional<Date>;

    public static generateKey(userId: number): { key: string, hash: string } {
        const key = createRandomString(43);
        const hash = createHash('sha256').update(key).digest(`base64url`)
        const fullKey = `bbmat.${userId.toString(16)}.${key}`;
        return { key: fullKey, hash };
    }

    public static async checkKey(key: string): Promise<number | null> {
        if (!EnvConfig.server.enableApiKeys) return null;

        const match = /^bbmat\.([0-9a-f]+)\.([A-Za-z0-9_-]{58})$/.exec(key);
        if (!match) return null;

        const userId = Number.parseInt(match[1], 16);
        if (!Number.isSafeInteger(userId) || userId <= 0) return null;

        const inputHash = createHash("sha256")
            .update(match[2])
            .digest("base64url");
        const inputHashBuffer = Buffer.from(inputHash);

        const keys = await this.findAll({ where: { userId } });
        try {
            for (const storedKey of keys) {
                const storedHashBuffer = Buffer.from(storedKey.key);
                if (
                    storedHashBuffer.length === inputHashBuffer.length &&
                    timingSafeEqual(storedHashBuffer, inputHashBuffer)
                ) {
                    return storedKey.userId;
                }
            }
        } catch (error) {
            Logger.error(`Error checking API key: ${parseErrorMessage(error)}`);
            return null;
        }

        return null;
    }
}