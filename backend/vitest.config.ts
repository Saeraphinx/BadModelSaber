import { defineConfig } from 'vitest/config';
import { parseErrorMessage } from './src/shared/Tools.ts';

export default defineConfig({
    test: {
        dir: './test',
        include: ['./tests/**/*.test.ts'],
        globalSetup: './test/globalSetup.ts',
        reporters: process.env.GITHUB_ACTIONS ? [`github-actions`, [`verbose`, { summary: true }]] : [ [`default`, { summary: false }] ],
        mockReset: true,
        testTimeout: 15000,
        hookTimeout: 30000,
        fileParallelism: true,
        isolate: true,
        pool: `forks`,
        provide: {
            postgresUrl: ""
        },
        passWithNoTests: true,
        dangerouslyIgnoreUnhandledErrors: true
    }
});