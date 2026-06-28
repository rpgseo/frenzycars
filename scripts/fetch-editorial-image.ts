/**
 * Fetch all available images for a car model and save them to /public/press/.
 * Use this when creating editorial content (reviews, news) for a specific car.
 *
 * Usage:
 *   npx tsx scripts/fetch-editorial-image.ts --make=Audi --model="A4" --year=2015
 *
 * Output:
 *   public/press/audi/audi-a4-2015/front_left.webp
 *   public/press/audi/audi-a4-2015/front.webp
 *   (one file per available view)
 */

import { existsSync, mkdirSync, writeFileSync } from 'fs';
import { join } from 'path';
import { config } from 'dotenv';
import { fetchAllCarImages } from './lib/car-image-fetcher.js';

if (existsSync('.env')) config();

const API_KEY = process.env.VEHICLE_IMAGERY_API_KEY;
if (!API_KEY) throw new Error('VEHICLE_IMAGERY_API_KEY env var required');

const args = process.argv.slice(2);
function arg(name: string) {
  return args.find(a => a.startsWith(`--${name}=`))?.split('=').slice(1).join('=');
}

const make = arg('make');
const model = arg('model');
const yearStr = arg('year');

if (!make || !model || !yearStr) {
  console.error('Usage: npx tsx scripts/fetch-editorial-image.ts --make=Audi --model=A4 --year=2015');
  process.exit(1);
}

const year = parseInt(yearStr, 10);

async function main() {
  console.log(`Fetching all images for ${make} ${model} ${year}...`);

  const images = await fetchAllCarImages({ make: make!, model: model!, year }, API_KEY!);

  if (!images.length) {
    console.error('No images found.');
    process.exit(1);
  }

  const makeSlug = make!.toLowerCase().replace(/\s+/g, '-');
  const modelSlug = model!.toLowerCase().replace(/\s+/g, '-');
  const destDir = join('public', 'press', makeSlug, `${makeSlug}-${modelSlug}-${year}`);
  mkdirSync(destDir, { recursive: true });

  console.log(`\nSaving to ${destDir}/`);
  for (const img of images) {
    const destPath = join(destDir, `${img.view}.webp`);
    writeFileSync(destPath, img.buffer);
    const kb = (img.buffer.length / 1024).toFixed(1);
    console.log(`  ✓ ${img.view}.webp (${kb} KB)`);
    console.log(`    alt: "${img.altText}"`);
  }

  console.log(`\nFirst image (use as cover):`);
  console.log(`  /press/${makeSlug}/${makeSlug}-${modelSlug}-${year}/${images[0].view}.webp`);
  console.log(`  alt: "${images[0].altText}"`);
}

main().catch(err => { console.error(err); process.exit(1); });
