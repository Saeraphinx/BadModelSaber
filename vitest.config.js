import { defineConfig } from 'vitest/config';

export default defineConfig({
    test: {
        include: [`**/*.test.ts`],
        setupFiles: [`./test/setup.ts`],
        //globalSetup: './test/dataSetup.ts',
        reporters: process.env.GITHUB_ACTIONS ? [`github-actions`, [`verbose`, { summary: true }]] : [[`basic`]],
        mockReset: true,
        testTimeout: 15000,
        pool: `forks`,
    }
});