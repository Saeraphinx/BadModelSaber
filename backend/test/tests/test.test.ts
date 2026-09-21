import { describe, test, expect } from "vitest";
import { EnvConfig } from "../../src/shared/EnvConfig";

describe(`example test suite`, () => {
    test(`envconfig loads`, () => {
        expect(process.env.VITEST).toBeTruthy();
        expect(process.env.NODE_ENV).toBe(`test`);
        expect(EnvConfig.isTestMode).toBeTruthy();
    });
});