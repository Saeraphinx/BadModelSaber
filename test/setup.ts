import { vi } from "vitest";

vi.mock(`../src/api/routes/public/all/auth.ts`, async (original) => {
        return {
            AuthRoutes: {
                loadRoutes: (router: any) => {
                    // do nothing
                }
            }
        };
    });