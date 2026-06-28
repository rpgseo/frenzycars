import { existsSync, mkdirSync, writeFileSync } from 'fs';
import { join } from 'path';
import { config } from 'dotenv';
import { fetchCarImage } from './lib/car-image-fetcher.js';

if (existsSync('.env')) config();

const API_KEY = process.env.VEHICLE_IMAGERY_API_KEY;
if (!API_KEY) throw new Error('VEHICLE_IMAGERY_API_KEY env var required');

const CF_ACCOUNT_ID = process.env.CF_ACCOUNT_ID!;
const CF_API_TOKEN = process.env.CF_API_TOKEN!;
const D1_DATABASE_ID = 'b9d5f455-8e9e-439c-9283-ef1b19addf4b';

const args = process.argv.slice(2);
const filterMake = args.find(a => a.startsWith('--make='))?.split('=')[1];
const dryRun = args.includes('--dry-run');

const sleep = (ms: number) => new Promise(r => setTimeout(r, ms));

async function d1Query(sql: string, params: any[] = []) {
  const res = await fetch(
    `https://api.cloudflare.com/client/v4/accounts/${CF_ACCOUNT_ID}/d1/database/${D1_DATABASE_ID}/query`,
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${CF_API_TOKEN}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ sql, params }),
    }
  );
  const data = await res.json() as any;
  if (!data.success) throw new Error(`D1 error: ${JSON.stringify(data.errors)}`);
  return data.result?.[0]?.results ?? [];
}

async function main() {
  let sql = 'SELECT make, model, trim, year, slug FROM cars ORDER BY make, year DESC';
  const params: any[] = [];
  if (filterMake) {
    sql = 'SELECT make, model, trim, year, slug FROM cars WHERE make = ? ORDER BY year DESC';
    params.push(filterMake);
  }

  const cars = await d1Query(sql, params);
  console.log(`Found ${cars.length} cars in D1${filterMake ? ` (make: ${filterMake})` : ''}`);

  let skipped = 0, downloaded = 0, errors = 0;

  for (const car of cars) {
    const makeSlug = car.make.toLowerCase().replace(/\s+/g, '-');
    const destDir = join('public', 'press', makeSlug, car.slug);
    const destPath = join(destDir, 'hero.webp');

    if (existsSync(destPath)) {
      console.log(`  ✗ skip  ${makeSlug}/${car.slug}`);
      skipped++;
      continue;
    }

    if (dryRun) {
      console.log(`  ? needs ${makeSlug}/${car.slug}`);
      continue;
    }

    if (!car.year) {
      console.log(`  ? skip  ${makeSlug}/${car.slug} (no year)`);
      skipped++;
      continue;
    }

    try {
      const result = await fetchCarImage(
        { make: car.make, model: car.model, year: car.year },
        API_KEY!
      );
      mkdirSync(destDir, { recursive: true });
      writeFileSync(destPath, result.buffer);
      const kb = (result.buffer.length / 1024).toFixed(1);
      console.log(`  ✓ saved ${makeSlug}/${car.slug}/hero.webp (${kb} KB) — "${result.altText}"`);
      downloaded++;
      await sleep(500);
    } catch (err: any) {
      console.error(`  ! error ${makeSlug}/${car.slug}: ${err.message}`);
      errors++;
    }
  }

  console.log(`\nDone: ${downloaded} downloaded, ${skipped} skipped, ${errors} errors`);
}

main().catch(err => { console.error(err); process.exit(1); });
