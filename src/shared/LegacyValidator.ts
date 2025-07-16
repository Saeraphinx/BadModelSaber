import { z } from "zod/v4";

export class LegacyValidator {
    public static readonly zFilterTypes = z.enum([`author`, `name`, `tag`, `hash`, `discordid`, `id`]);
    public static zFilterAssetv2 = z.object({
        type: z.enum(["all", `saber`, `avatar`, `platform`, `bloq`]).default(`all`),
        platform: z.enum([`all`, `pc`, `quest`]).default(`all`),
        start: z.number().int().min(0).default(0),
        end: z.number().int().min(1).optional(),
        sort: z.enum([`date`, `name`, `author`]).default(`date`),
        sortDirection: z.enum([`asc`, `desc`]).default(`asc`),
        filter: z.preprocess((val, ctx) => {
            if (typeof val !== `string`) {
                ctx.addIssue({
                    code: `custom`,
                    message: `Filter must be a string`
                });
                return;
            }
            let stringVal = val;
            if (stringVal.indexOf(`:`) === -1) {
                stringVal = `name:${val}*`;
            }
            let splitComma = stringVal.split(`,`);
            let splitColon = splitComma.map((v) => v.split(`:`));
            return (splitColon.map((v) => {
                if (v.length !== 2) {
                    ctx.addIssue({
                        code: `custom`,
                        message: `Filter must be in the format 'type:value'`
                    });
                    return null;
                }
                return {
                    type: v[0],
                    value: v[1]
                };
            }).filter((v) => v !== null));
        }, z.object({
            type: LegacyValidator.zFilterTypes,
            value: z.string().min(1).max(1000)
        }).array().optional()
        ).optional(),
    })
}