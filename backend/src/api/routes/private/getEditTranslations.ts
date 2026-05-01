import { TRPCError } from "@trpc/server";
import { router, anyProcedure, loggedInProcedure } from "../../trpc.ts";
import { availableBackendLocaleCodes, availableFrontendLocaleCodes, Project } from "../../../shared/Database.ts";
import z from "zod";
import { Translation } from "../../../shared/database/tables/Translation.ts";

export const getEditTranslationsRouter = router({
    getTranslationsForProject: loggedInProcedure()
        .input(z.object({
            projectId: z.number(),
        }))
        .query(async ({ input, ctx }) => {
            let project = await Project.findByPk(input.projectId);
            if (!project) {
                throw new TRPCError({ code: 'NOT_FOUND', message: 'Project not found.' });
            }

            if (!(await project.canView(ctx.user))) {
                throw new TRPCError({ code: 'FORBIDDEN', message: 'You do not have permission to view this project.' });
            }

            let translations = await Translation.findAll({
                where: {
                    parentId: input.projectId,
                }
            });

            return translations.map(t => t.toJSON());
        }),
    createOrUpdateTranslationForProject: loggedInProcedure()
        .input(z.object({
            projectId: z.number(),
            language: z.enum(availableBackendLocaleCodes),
            contentType: z.enum([`name`, `description`, `summary`]),
            translatedString: z.string(),
        }))
        .mutation(async ({ input, ctx }) => {
            let project = await Project.findByPk(input.projectId);
            if (!project) {
                throw new TRPCError({ code: 'NOT_FOUND', message: 'Project not found.' });
            }

            if (!(await project.canTranslate(ctx.user))) {
                throw new TRPCError({ code: 'FORBIDDEN', message: 'You do not have permission to translate this project.' });
            }

            let existingTranslation = await Translation.findOne({
                where: {
                    parentId: input.projectId,
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
                    parentId: input.projectId,
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