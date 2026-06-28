/**
 * Pipeline: CarImages API → Cloudflare R2 → D1
 *
 * Para cada coche en D1 sin hero_url:
 *   1. Pide signed URL a CarImages
 *   2. Descarga la imagen WebP
 *   3. Sube a R2 en press/{make}/{slug}/hero.webp
 *   4. Actualiza hero_url en D1
 *
 * Uso:
 *   npx tsx scripts/fetch-carimages.ts
 *   npx tsx scripts/fetch-carimages.ts --make=BMW
 *   npx tsx scripts/fetch-carimages.ts --overwrite   # re-descarga aunque ya tenga hero_url
 *   npx tsx scripts/fetch-carimages.ts --dry-run
 */

import { existsSync } from 'fs';
import { config } from 'dotenv';
import { S3Client, PutObjectCommand, HeadObjectCommand } from '@aws-sdk/client-s3';
if (existsSync('.env')) config();

const CAR_IMAGES_KEY = process.env.CAR_IMAGES_API_KEY;
if (!CAR_IMAGES_KEY) throw new Error('CAR_IMAGES_API_KEY no encontrada en .env');

const R2_BUCKET        = process.env.R2_BUCKET!;
const R2_ENDPOINT      = process.env.R2_ENDPOINT!;
const R2_ACCESS_KEY_ID = process.env.R2_ACCESS_KEY_ID!;
const R2_SECRET        = process.env.R2_SECRET_ACCESS_KEY!;
const R2_PUBLIC_URL    = process.env.R2_PUBLIC_URL!;

const CF_ACCOUNT_ID  = process.env.CF_ACCOUNT_ID!;
const CF_API_TOKEN   = process.env.CF_API_TOKEN!;
const D1_DATABASE_ID = 'b9d5f455-8e9e-439c-9283-ef1b19addf4b';

const args      = process.argv.slice(2);
const filterMake = args.find(a => a.startsWith('--make='))?.split('=')[1];
const overwrite  = args.includes('--overwrite');
const dryRun     = args.includes('--dry-run');

const sleep = (ms: number) => new Promise(r => setTimeout(r, ms));

// ── S3 client apuntando a R2 ─────────────────────────────────────────────────

const s3 = new S3Client({
  region: 'auto',
  endpoint: R2_ENDPOINT,
  credentials: { accessKeyId: R2_ACCESS_KEY_ID, secretAccessKey: R2_SECRET },
});

async function uploadToR2(key: string, body: Buffer, contentType = 'image/webp') {
  await s3.send(new PutObjectCommand({
    Bucket: R2_BUCKET,
    Key: key,
    Body: body,
    ContentType: contentType,
    CacheControl: 'public, max-age=31536000',
  }));
  return `${R2_PUBLIC_URL}/${key}`;
}

async function existsInR2(key: string): Promise<boolean> {
  try {
    await s3.send(new HeadObjectCommand({ Bucket: R2_BUCKET, Key: key }));
    return true;
  } catch {
    return false;
  }
}

// ── D1 ───────────────────────────────────────────────────────────────────────

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
  if (!data.success) throw new Error(`D1: ${JSON.stringify(data.errors)}`);
  return data.result?.[0]?.results ?? [];
}

async function ensureHeroUrlColumn() {
  try {
    await d1Query(`ALTER TABLE cars ADD COLUMN hero_url TEXT`);
    console.log('✓ Columna hero_url añadida a D1');
  } catch {
    // Ya existe, ignorar
  }
}

// ── CarImages API ─────────────────────────────────────────────────────────────

async function getSignedUrl(make: string, model: string, year?: number | null): Promise<string | null> {
  const params = new URLSearchParams({ api_key: CAR_IMAGES_KEY!, make, model, width: '1200' });
  if (year) params.set('year', String(year));
  const res = await fetch(`https://carimagesapi.com/api/v1/signed-url?${params}`);
  if (!res.ok) {
    console.error(`  CarImages ${res.status} para ${make} ${model}`);
    return null;
  }
  const data = await res.json() as any;
  return data.url ?? null;
}

async function downloadImage(url: string): Promise<Buffer | null> {
  const res = await fetch(url);
  if (!res.ok) return null;
  return Buffer.from(await res.arrayBuffer());
}

// ── Main ─────────────────────────────────────────────────────────────────────

async function main() {
  await ensureHeroUrlColumn();

  let sql = overwrite
    ? 'SELECT make, model, trim, year, slug FROM cars ORDER BY make, model'
    : 'SELECT make, model, trim, year, slug FROM cars WHERE hero_url IS NULL ORDER BY make, model';

  const params: any[] = [];
  if (filterMake) {
    sql = overwrite
      ? 'SELECT make, model, trim, year, slug FROM cars WHERE make = ? ORDER BY model'
      : 'SELECT make, model, trim, year, slug FROM cars WHERE hero_url IS NULL AND make = ? ORDER BY model';
    params.push(filterMake);
  }

  const cars = await d1Query(sql, params);
  console.log(`\n${cars.length} coches sin hero_url${filterMake ? ` (${filterMake})` : ''}\n`);

  let uploaded = 0, skipped = 0, errors = 0;

  for (const car of cars) {
    const makeSlug = car.make.toLowerCase().replace(/[\s-]+/g, '-');
    const r2Key    = `press/${makeSlug}/${car.slug}/hero.webp`;

    if (dryRun) {
      console.log(`  ? ${car.slug}`);
      continue;
    }

    // Si ya está en R2 y no se fuerza overwrite, solo actualiza D1
    if (!overwrite && await existsInR2(r2Key)) {
      const url = `${R2_PUBLIC_URL}/${r2Key}`;
      await d1Query('UPDATE cars SET hero_url = ? WHERE slug = ?', [url, car.slug]);
      console.log(`  → sync  ${car.slug} (ya en R2)`);
      skipped++;
      continue;
    }

    try {
      const signedUrl = await getSignedUrl(car.make, car.model, car.year);
      if (!signedUrl) { errors++; continue; }

      const buf = await downloadImage(signedUrl);
      if (!buf) { console.error(`  ✗ sin imagen ${car.slug}`); errors++; continue; }

      const publicUrl = await uploadToR2(r2Key, buf);
      await d1Query('UPDATE cars SET hero_url = ? WHERE slug = ?', [publicUrl, car.slug]);

      const kb = (buf.length / 1024).toFixed(1);
      console.log(`  ✓ ${car.slug}  (${kb} KB) → ${publicUrl}`);
      uploaded++;
    } catch (err: any) {
      console.error(`  ! ${car.slug}: ${err.message}`);
      errors++;
    }

    await sleep(400);
  }

  console.log(`\nDone: ${uploaded} subidas, ${skipped} ya existían, ${errors} errores`);
}

main().catch(err => { console.error(err); process.exit(1); });
