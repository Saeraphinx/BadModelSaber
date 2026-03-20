import { UniqueConstraintError, ValidationError } from "sequelize";
import { fromZodError, isZodErrorLike } from "zod-validation-error";
import * as fs from "fs";
import { randomBytes } from "crypto";
import { TRPCError } from "@trpc/server";
import { Logger } from "./Logger.ts";

export type If<Value extends boolean, TrueResult, FalseResult = null> = Value extends true ? TrueResult : Value extends false  ? FalseResult  : TrueResult | FalseResult;

export function parseErrorMessage(err: unknown): string {
    try {
        if (err instanceof ValidationError || err instanceof UniqueConstraintError) {
            return `${err.message} ${err.errors.map(e => e.message).join(`, `)}`;
        } else if (isZodErrorLike(err)) {
            //console.error(`Zod error detected:`, JSON.stringify(err, null, 2));
            return fromZodError(err).toString();
        } else if (err instanceof Error) {
            return `${err.message}`;
        } else if (typeof err === `string`) {
            return err;
        } else {
            return JSON.stringify(err);
        }
    } catch (e) {
        console.error(`Error parsing error message: ${e}`);
        return `Unknown error`;
    }
}

export function handleCatch(where?: string): (err: unknown) => never {
    return (err: unknown) => {
        let message = parseErrorMessage(err);
        Logger.log(`${where ? `Error in ${where}` : `Error`}: ${message}`);
        Logger.debug(JSON.stringify(err));
        if (isZodErrorLike(err) || err instanceof ValidationError || err instanceof UniqueConstraintError) {
            throw new TRPCError({ code: "BAD_REQUEST", message });
        } else {
            throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message });
        }
    };
}

export function createRandomString(byteCount: number): string {
    let key = randomBytes(byteCount).toString(`base64url`);
    return key;
}

export function getGitVersion(): string {
    let gitVersion = `Version not found.`;
    if (fs.existsSync(`.git/HEAD`) || process.env.GIT_VERSION) {
        if (process.env.GIT_VERSION) {
            gitVersion = `${process.env.GIT_VERSION.substring(0, 7)}`;
        } else {
            let gitId = fs.readFileSync(`.git/HEAD`, `utf8`);
            if (gitId.indexOf(`:`) !== -1) {
                let refPath = `.git/` + gitId.substring(5).trim();
                gitId = fs.readFileSync(refPath, `utf8`);
            }

            gitVersion = `${gitId.substring(0, 7)}`;
        }
    }
    return gitVersion;
}

export function capitalizeWords(sentence: string): string {
  const words = sentence.split(' ');

  const capitalizedWords = words.map(word => {
    if (word.length === 0) {
      return '';
    }
    return word.charAt(0).toUpperCase() + word.slice(1);
  });

  return capitalizedWords.join(' ');
}

export function dedupeArray(arr: any[]): typeof arr {
    return Array.from(new Set(arr));
}