import { describe, expect, test } from "vitest";
import { Context, createContext } from "../../src/api/trpc.ts";
import { createCaller } from "../../src/api/routers.ts";

// most endpoints don't actually need a fully functional context, so we can just kinda do this
function createTestContext(userId: string): Context {
    return {
        req: {} as any,
        res: {} as any,
        userId: userId,
        db: {} as any,
    };
}


describe("API Tests", () => {
    test("Sample API Test", async () => {
        let ctx = createTestContext("1");
        let caller = createCaller(ctx);

        let status = await caller.statusRouter.status();
        expect(status.message).toBeDefined();
    });
});