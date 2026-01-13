import { defineConfig } from 'vitest/config';

export default defineConfig({
    test: {
        include: [`**/*.test.ts`],
        globalSetup: './test/globalSetup.ts',
        reporters: process.env.GITHUB_ACTIONS ? [`github-actions`, [`verbose`, { summary: true }]] : [ [`default`, { summary: false }] ],
        mockReset: true,
        testTimeout: 15000,
        hookTimeout: 30000,
        pool: `forks`,
    }
});