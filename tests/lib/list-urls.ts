import { readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';

export function listUrls(dir: string): string[] {
  const urls: string[] = [];
  function walk(current: string, rel: string) {
    for (const entry of readdirSync(current)) {
      const abs = join(current, entry);
      if (statSync(abs).isDirectory()) {
        walk(abs, `${rel}${entry}/`);
      } else if (entry === 'index.html') {
        urls.push(rel === '' ? '/' : `/${rel}`.replace(/\/+/g, '/'));
      }
    }
  }
  walk(dir, '');
  return urls.sort();
}
