/**
 * Test rápido de CarsXE Images API
 * Prueba: Honda Civic SI 2023 + VW Golf GTI 2023
 * Uso: npx tsx scripts/test-carsxe.ts
 */

import { existsSync } from 'fs';
import { config } from 'dotenv';
if (existsSync('.env')) config();

const KEY = process.env.CARSXE_API_KEY;
if (!KEY) throw new Error('CARSXE_API_KEY no encontrada en .env');

const BASE = 'https://api.carsxe.com/images';

async function fetchImages(make: string, model: string, year: number, angle = 'exterior') {
  const url = `${BASE}?key=${KEY}&make=${encodeURIComponent(make)}&model=${encodeURIComponent(model)}&year=${year}&angle=${angle}`;
  console.log(`\nGET ${url.replace(KEY, '***')}`);
  const res = await fetch(url);
  const data = await res.json() as any;
  return data;
}

async function main() {
  const tests = [
    { make: 'Honda', model: 'Civic SI', year: 2023 },
    { make: 'Volkswagen', model: 'Golf GTI', year: 2023 },
  ];

  for (const { make, model, year } of tests) {
    console.log(`\n${'─'.repeat(60)}`);
    console.log(`${make} ${model} ${year}`);

    for (const angle of ['exterior', 'interior']) {
      const data = await fetchImages(make, model, year, angle);
      const images = data.images ?? data ?? [];
      const count = Array.isArray(images) ? images.length : 0;
      console.log(`  [${angle}] → ${count} imágenes`);
      if (count > 0) {
        console.log(`    Primera:`, JSON.stringify(images[0], null, 2));
      } else {
        console.log(`    Respuesta raw:`, JSON.stringify(data).slice(0, 300));
      }
    }
  }
}

main().catch(console.error);
