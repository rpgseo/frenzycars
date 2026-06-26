import { defineConfig } from 'astro/config';
import sitemap from '@astrojs/sitemap';

export default defineConfig({
  output: 'static',
  site: 'https://frenzycars.com',
  trailingSlash: 'always',
  build: { format: 'directory' },
  integrations: [sitemap()],
});
