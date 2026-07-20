import { TRPCError } from "@trpc/server";
import { router, anyProcedure, loggedInProcedure, loggedInProjectProcedure } from "../../trpc.ts";
import { availableBackendLocaleCodes, availableFrontendLocaleCodes, Project, UserPermissions } from "../../../shared/Database.ts";
import z from "zod";
import { Translation } from "../../../shared/database/tables/Translation.ts";

export const getEditTranslationsRouter = router({
    getTranslationsForProject: loggedInProjectProcedure()
        .query(async ({ input, ctx }) => {
            if (!(await ctx.project.canView(ctx.user))) {
                throw new TRPCError({ code: 'FORBIDDEN', message: 'You do not have permission to view this project.' });
            }

            let translations = await Translation.findAll({
                where: {
                    parentId: ctx.project.id,
                }
            });

            return translations.map(t => t.toJSON());
        }),
    createOrUpdateTranslationForProject: loggedInProjectProcedure()
        .input(z.object({
            language: z.enum(availableBackendLocaleCodes),
            contentType: z.enum([`name`, `description`, `summary`]),
            translatedString: z.string(),
        }))
        .mutation(async ({ input, ctx }) => {
            const project = ctx.project;
            if (!(await project.canTranslate(ctx.user))) {
                throw new TRPCError({ code: 'FORBIDDEN', message: 'You do not have permission to translate this project.' });
            }

            let existingTranslation = await Translation.findOne({
                where: {
                    parentId: project.id,
                    language: input.language,
                    contentType: input.contentType,
                }
            });

            if (existingTranslation) {
                existingTranslation.translatedString = input.translatedString;
                existingTranslation.translatedBy = ctx.user.id;
                existingTranslation.originalString = project[input.contentType];
                existingTranslation.outOfDate = false;
                await existingTranslation.save();
                return existingTranslation.toJSON();
            } else {
                let newTranslation = await Translation.create({
                    parentId: project.id,
                    contentType: input.contentType,
                    language: input.language,
                    translatedString: input.translatedString,
                    translatedBy: ctx.user.id,
                    originalString: project[input.contentType], // e.g. project.name, project.description, etc.
                    outOfDate: false,

                });
                return newTranslation.toJSON();
            }  
        })
});