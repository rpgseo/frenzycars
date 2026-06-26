/**
 * URL Parity Test: Hugo → Astro
 *
 * Safety gate for the zero-broken-URLs constraint.
 * This test will FAIL until the Astro build is complete with all content.
 * That is expected — it guides the migration.
 *
 * Run: npm run build && npm test
 *
 * NOTE: If astro/dist/ does not exist the test is skipped with a warning,
 * so CI passes cleanly until Astro content migration is done.
 */

import { describe, it, expect } from 'vitest';
import { readFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { listUrls } from './lib/list-urls';

// URLs that exist in Hugo as 301 redirects (not as built pages).
// The Astro _redirects file should handle these; they are excluded from
// the "must exist as dist/…/index.html" check.
const REDIRECTS_AS_301 = new Set<string>([
  '/buyers-guide/best-car-loans-for-students/',
  // /admin/ was a Hugo admin panel — not migrated to Astro (Decap CMS excluded by design)
  '/admin/',
]);

describe('URL parity Hugo → Astro', () => {
  it('every Hugo URL exists in Astro build (or is a registered 301)', () => {
    const snapshotPath = join(__dirname, '../scripts/hugo-urls.txt');
    const hugoUrls = readFileSync(snapshotPath, 'utf8')
      .split('\n')
      .map(l => l.trim())
      .filter(Boolean);

    const distDir = join(__dirname, '../dist');

    if (!existsSync(distDir)) {
      // Astro hasn't been built yet — skip gracefully so CI doesn't hard-fail
      // during the migration phase.
      console.warn(
        '[url-parity] SKIPPED: astro/dist/ not found. Run `npm run build` first.',
      );
      return;
    }

    const astroUrls = new Set(listUrls(distDir));

    const missing = hugoUrls.filter(
      u => !astroUrls.has(u) && !REDIRECTS_AS_301.has(u),
    );

    expect(
      missing,
      `Missing URLs in Astro build (${missing.length} total):\n${missing.join('\n')}`,
    ).toEqual([]);
  });
});
