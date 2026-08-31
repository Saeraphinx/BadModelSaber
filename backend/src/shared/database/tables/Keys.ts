import { CreationOptional, InferAttributes, InferCreationAttributes } from "sequelize";
import { AllowNull, Column, CreatedAt, DataType, Model, PrimaryKey, Table, UpdatedAt } from "sequelize-typescript";
import { createRandomString } from "../../Tools.ts";
import { createHash, timingSafeEqual } from "crypto";

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
        const hash = createRandomString(32);
        const key = `bbmat.${userId.toString(16)}.${createHash('sha256').update(hash).digest(`base64url`)}`;
        return { key, hash };
    }

    public static async checkKey(key: string): Promise<number | null> {
        let splitKey = key.split('.');
        if (splitKey.length !== 3 || splitKey[0] !== 'bbmat') {
            return null;
        }

        const userId = parseInt(splitKey[1], 16);
        const hash = splitKey[2];
        if (isNaN(userId) || hash.length !== 43) {
            return null;
        }

        const keyInstances = await this.findAll({ where: { userId } });
        const inputHashBuffer = Buffer.from(hash);
        try {
            for (const keyInstance of keyInstances) {
                const dbHashBuffer = Buffer.from(keyInstance.key.split('.')[2]);
                if (dbHashBuffer.length === inputHashBuffer.length && timingSafeEqual(dbHashBuffer, inputHashBuffer)) {
                    return keyInstance.userId;
                }
            }
        } catch (error) {
            return null;
        }
        return null;
    }
}