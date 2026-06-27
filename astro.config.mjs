import { defineConfig } from 'astro/config';
import cloudflare from '@astrojs/cloudflare';
import sitemap from '@astrojs/sitemap';

export default defineConfig({
  output: 'static',
  site: 'https://frenzycars.com',
  adapter: cloudflare(),
  trailingSlash: 'always',
  build: { format: 'directory' },
  integrations: [sitemap()],
});
