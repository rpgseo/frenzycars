/**
 * Test CarImages API con Honda Civic SI 2023 y VW Golf GTI 2023
 * Uso: npx tsx scripts/test-carimages.ts
 */

import { existsSync, mkdirSync, writeFileSync } from 'fs';
import { config } from 'dotenv';
if (existsSync('.env')) config();

const KEY = process.env.CAR_IMAGES_API_KEY;
if (!KEY) throw new Error('CAR_IMAGES_API_KEY no encontrada en .env');

const BASE = 'https://carimagesapi.com/api/v1';

async function getSignedUrl(make: string, model: string, year?: number) {
  const params = new URLSearchParams({ api_key: KEY!, make, model });
  if (year) params.set('year', String(year));
  const url = `${BASE}/signed-url?${params}`;
  console.log(`GET ${url.replace(KEY!, '***')}`);
  const res = await fetch(url);
  const data = await res.json() as any;
  if (!res.ok) throw new Error(`API ${res.status}: ${JSON.stringify(data)}`);
  return data;
}

async function getMakes() {
  const res = await fetch(`${BASE}/makes`, {
    headers: { Authorization: `Bearer ${KEY}` },
  });
  return res.json();
}

async function main() {
  // 1. Listar makes disponibles
  console.log('Makes disponibles:');
  const makes = await getMakes() as any;
  const makeList = Array.isArray(makes) ? makes : (makes.makes ?? makes.data ?? []);
  console.log(makeList.slice(0, 10).join(', '), '...\n');

  // 2. Signed URLs para los dos coches de prueba
  const tests = [
    { make: 'Honda', model: 'Civic SI', year: 2023 },
    { make: 'Volkswagen', model: 'Golf GTI', year: 2023 },
  ];

  for (const { make, model, year } of tests) {
    console.log(`\n── ${make} ${model} ${year}`);
    const data = await getSignedUrl(make, model, year);
    console.log('Respuesta:', JSON.stringify(data, null, 2));

    const imgUrl = data.url ?? data.signed_url ?? data.image_url;
    if (imgUrl) {
      const imgRes = await fetch(imgUrl);
      if (imgRes.ok) {
        const buf = Buffer.from(await imgRes.arrayBuffer());
        const fname = `tmp/${make.toLowerCase()}-${model.toLowerCase().replace(/\s+/g, '-')}.webp`;
        mkdirSync('tmp', { recursive: true });
        writeFileSync(fname, buf);
        console.log(`✓ Guardada ${fname} (${(buf.length / 1024).toFixed(1)} KB)`);
      }
    }
  }
}

main().catch(console.error);
