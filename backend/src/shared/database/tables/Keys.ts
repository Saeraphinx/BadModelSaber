import { CreationOptional, InferAttributes, InferCreationAttributes } from "sequelize";
import { AllowNull, Column, DataType, Model, PrimaryKey, Table } from "sequelize-typescript";
import { createRandomString } from "../../Tools.ts";
import { createHash, timingSafeEqual } from "crypto";

const nullHash = createHash('sha256').update(`null`).digest(`base64url`);

@Table({
    tableName: "keys",
    modelName: "keys",
})
export class Keys extends Model<InferAttributes<Keys>, InferCreationAttributes<Keys>> {
    @PrimaryKey
    @AllowNull(false)
    @Column(DataType.CHAR(43))
    declare key: string;

    @AllowNull(false)
    @Column(DataType.INTEGER)
    declare userId: number;

    public static generateKey(): { key: string, hash: string } {
        const hash = createRandomString(64); // Replace this with your actual hash generation logic
        const key = createHash('sha256').update(hash).digest(`base64url`);
        return { key, hash };
    }

    public static async checkKey(key: string): Promise<number | null> {
        let hash = createHash('sha256').update(key).digest(`base64url`);
        const keyInstance = await this.findByPk(hash);

        // Use timingSafeEqual to prevent timing attacks and check that the key exists (since the backup hash is always the same)
        if (timingSafeEqual(Buffer.from(keyInstance?.key ?? nullHash), Buffer.from(hash)) && keyInstance) {
            return keyInstance.userId;
        } else {
            return null;
        }
    }
}