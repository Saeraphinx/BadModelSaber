import { defineConfig } from 'vitest/config';
import { parseErrorMessage } from './src/shared/Tools';

export default defineConfig({
    test: {
        dir: './test/tests',
        globalSetup: './test/globalSetup.ts',
        reporters: process.env.GITHUB_ACTIONS ? [`github-actions`, [`verbose`, { summary: true }]] : [ [`default`, { summary: false }] ],
        mockReset: true,
        testTimeout: 15000,
        hookTimeout: 30000,
        pool: `forks`,
        provide: {
            postgresUrl: ""
        },
        passWithNoTests: true,
        // for when this eventually moves to vitest 4
        onUnhandledError: (error) => {
            console.error(`Unhandled error in test: ${parseErrorMessage(error)}`);
            return true; // Prevent Vitest from crashing on unhandled errors
        },
    }
});