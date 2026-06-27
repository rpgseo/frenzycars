import { defineConfig } from 'astro/config';
import cloudflare from '@astrojs/cloudflare';
import sitemap from '@astrojs/sitemap';
import react from '@astrojs/react';

export default defineConfig({
  output: 'static',
  site: 'https://frenzycars.com',
  adapter: cloudflare({ prerenderEnvironment: 'node' }),
  trailingSlash: 'always',
  build: { format: 'directory' },
  integrations: [sitemap(), react()],
});