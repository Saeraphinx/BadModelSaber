import { paraglideVitePlugin } from '@inlang/paraglide-js'
import tailwindcss from '@tailwindcss/vite';
import { sveltekit } from '@sveltejs/kit/vite';
import { defineConfig } from 'vite';

export default defineConfig({
  plugins: [
    paraglideVitePlugin({ 
      project: './project.inlang', 
      outdir: './src/lib/paraglide',
      strategy: [`localStorage`, `preferredLanguage`, `url`, `baseLocale`]
    }),
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
