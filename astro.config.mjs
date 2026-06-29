import { defineConfig } from 'astro/config';
import cloudflare from '@astrojs/cloudflare';
import sitemap from '@astrojs/sitemap';
import react from '@astrojs/react';

export default defineConfig({
  output: 'static',
  site: 'https://frenzycars.com',
  adapter: cloudflare({
    prerenderEnvironment: 'node',
    routes: {
      strategy: 'include',
      include: ['/content/*', '/api/content/*'],
    },
  }),
  trailingSlash: 'always',
  build: { format: 'directory' },
  integrations: [sitemap(), react()],
  vite: {
    server: { watch: { ignored: ['**/workers/**'] } },
    optimizeDeps: { exclude: ['workers'] },
  },
});