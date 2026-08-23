import tailwindcss from '@tailwindcss/vite';
import { sveltekit } from '@sveltejs/kit/vite';
import { defineConfig } from 'vite';

export default defineConfig({
  plugins: [
    tailwindcss(), 
    sveltekit()
  ],
  server: {
    warmup: {
      clientFiles: [
        './src/lib/scripts/utils/api.ts',
        './src/lib/scripts/utils/checkRoles.ts',
        './src/lib/scripts/from_backend/DBExtras.ts',
        './src/lib/shadcn/utils.ts',
        './src/lib/shadcn/components/ui/button/*'
      ]
    }
  },
  preview: {
    allowedHosts: [`bms.saera.gay`],
  }
});
