/**
 * Fetches hero images for all cars in D1 using the Vehicle Images API (RapidAPI / VehicleInsights).
 * Endpoint: GET /vehicle_images_by_ymm?make=&model=&year=&image_size=1280
 *
 * Usage:
 *   npx tsx scripts/fetch-car-images-ymm.ts
 *   npx tsx scripts/fetch-car-images-ymm.ts --make=BMW
 *   npx tsx scripts/fetch-car-images-ymm.ts --dry-run
 *   npx tsx scripts/fetch-car-images-ymm.ts --overwrite   # re-download even if hero.webp exists
 */

import { existsSync, mkdirSync, writeFileSync } from 'fs';
import { join } from 'path';
import { config } from 'dotenv';
import sharp from 'sharp';

if (existsSync('.env')) config();

const RAPIDAPI_KEY = process.env.RAPIDAPI_KEY;
if (!RAPIDAPI_KEY) throw new Error('RAPIDAPI_KEY env var required');

const CF_ACCOUNT_ID = process.env.CF_ACCOUNT_ID!;
const CF_API_TOKEN = process.env.CF_API_TOKEN!;
const D1_DATABASE_ID = 'b9d5f455-8e9e-439c-9283-ef1b19addf4b';

const args = process.argv.slice(2);
const filterMake = args.find(a => a.startsWith('--make='))?.split('=')[1];
const dryRun = args.includes('--dry-run');
const overwrite = args.includes('--overwrite');

const sleep = (ms: number) => new Promise(r => setTimeout(r, ms));

async function d1Query(sql: string, params: any[] = []) {
  const res = await fetch(
    `https://api.cloudflare.com/client/v4/accounts/${CF_ACCOUNT_ID}/d1/database/${D1_DATABASE_ID}/query`,
    {
      method: 'POST',
      headers: { Authorization: `Bearer ${CF_API_TOKEN}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ sql, params }),
    }
  );
  const data = await res.json() as any;
  if (!data.success) throw new Error(`D1 error: ${JSON.stringify(data.errors)}`);
  return data.result?.[0]?.results ?? [];
}

interface VehicleImage {
  title: string;
  url: string;
  category: string;
  width: number;
  height: number;
}

async function fetchYmmImages(make: string, model: string, year: number): Promise<VehicleImage[]> {
  const params = new URLSearchParams({
    make: make.toLowerCase(),
    model: model.toLowerCase().replace(/\s+/g, '-'),
    year: String(year),
    image_size: '1280',
  });
  const res = await fetch(`https://vehicle-images2.p.rapidapi.com/vehicle_images_by_ymm?${params}`, {
    headers: {
      'x-rapidapi-host': 'vehicle-images2.p.rapidapi.com',
      'x-rapidapi-key': RAPIDAPI_KEY!,
    },
  });
  if (!res.ok) throw new Error(`API ${res.status}: ${res.statusText}`);
  const data = await res.json() as any;
  if (data.code !== 200) throw new Error(`API returned code ${data.code}`);
  return (data.images ?? []) as VehicleImage[];
}

async function downloadAsWebp(url: string): Promise<Buffer> {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Image fetch ${res.status}: ${url}`);
  const buf = Buffer.from(await res.arrayBuffer());
  return sharp(buf)
    .resize({ width: 1200, height: 675, fit: 'cover', position: 'centre' })
    .webp({ quality: 82 })
    .toBuffer();
}

async function main() {
  let sql = 'SELECT make, model, trim, year, slug FROM cars WHERE year IS NOT NULL ORDER BY make, year DESC';
  const params: any[] = [];
  if (filterMake) {
    sql = 'SELECT make, model, trim, year, slug FROM cars WHERE year IS NOT NULL AND make = ? ORDER BY year DESC';
    params.push(filterMake);
  }

  const cars = await d1Query(sql, params);
  console.log(`Found ${cars.length} cars in D1${filterMake ? ` (make: ${filterMake})` : ''}`);

  let skipped = 0, downloaded = 0, errors = 0, noImages = 0;

  for (const car of cars) {
    const makeSlug = car.make.toLowerCase().replace(/\s+/g, '-');
    const destDir = join('public', 'press', makeSlug, car.slug);
    const destPath = join(destDir, 'hero.webp');

    if (!overwrite && existsSync(destPath)) {
      console.log(`  – skip  ${car.slug} (ya existe)`);
      skipped++;
      continue;
    }

    if (dryRun) {
      console.log(`  ? needs ${car.slug}`);
      continue;
    }

    try {
      const images = await fetchYmmImages(car.make, car.model, car.year);
      // Prefer EXTERIOR images; fall back to first available
      const exterior = images.filter(i => i.category === 'EXTERIOR');
      const chosen = exterior[0] ?? images[0];

      if (!chosen) {
        console.log(`  ✗ no img ${car.slug}`);
        noImages++;
        await sleep(300);
        continue;
      }

      const webp = await downloadAsWebp(chosen.url);
      mkdirSync(destDir, { recursive: true });
      writeFileSync(destPath, webp);
      const kb = (webp.length / 1024).toFixed(1);
      console.log(`  ✓ saved ${car.slug}/hero.webp (${kb} KB)`);
      downloaded++;
    } catch (err: any) {
      console.error(`  ! error ${car.slug}: ${err.message}`);
      errors++;
    }

    await sleep(400);
  }

  console.log(`\nDone: ${downloaded} descargadas, ${skipped} saltadas, ${noImages} sin imágenes, ${errors} errores`);
}

main().catch(err => { console.error(err); process.exit(1); });
