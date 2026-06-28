import { existsSync } from 'fs';
import { makeCarSlug } from '../src/lib/car-slug.js';
import { config } from 'dotenv';
if (existsSync('.env')) config();

const RAPIDAPI_KEY = process.env.RAPIDAPI_KEY;
if (!RAPIDAPI_KEY) throw new Error('RAPIDAPI_KEY env var required');

const CF_ACCOUNT_ID = process.env.CF_ACCOUNT_ID;
const CF_API_TOKEN = process.env.CF_API_TOKEN;
const D1_DATABASE_ID = 'b9d5f455-8e9e-439c-9283-ef1b19addf4b';

// Limit makes for free/dev use. Set SEED_MAX_MAKES=0 for all (paid plan).
const MAX_MAKES = Number(process.env.SEED_MAX_MAKES ?? 3);

// Filter to specific makes: SEED_MAKES="Toyota,Honda,BMW"
const SEED_MAKES = process.env.SEED_MAKES
  ? new Set(process.env.SEED_MAKES.split(',').map(s => s.trim()))
  : null;

const sleep = (ms: number) => new Promise(r => setTimeout(r, ms));

// ── CarSpecsAPI ──────────────────────────────────────────────────────────────

const RAPID_HEADERS = {
  'x-rapidapi-host': 'car-specs.p.rapidapi.com',
  'x-rapidapi-key': RAPIDAPI_KEY!,
};

async function apiGet(path: string, retries = 3): Promise<any> {
  for (let i = 0; i < retries; i++) {
    const res = await fetch(`https://car-specs.p.rapidapi.com${path}`, { headers: RAPID_HEADERS });
    if (res.status === 429) {
      const wait = 3000 * (i + 1);
      console.log(`  429 rate limit, waiting ${wait}ms...`);
      await sleep(wait);
      continue;
    }
    if (!res.ok) throw new Error(`CarSpecsAPI ${path} → ${res.status} ${res.statusText}`);
    await sleep(250);
    return res.json();
  }
  throw new Error(`CarSpecsAPI → 429 after ${retries} retries`);
}

function specsFromTrim(t: any) {
  return {
    powerHp: t.engineHp ?? null,
    torqueNm: t.maximumTorqueNM ?? null,
    displacementCc: t.capacityCm3 ?? null,
    acceleration0100: t.acceleration0To100KmPerHS ?? null,
    topSpeedKmh: t.topSpeedKmH ?? null,
    fuelConsumptionCombined: t.fuelConsumptionCombinedL100Km ?? null,
    co2: t.co2EmissionsGKm ?? null,
    lengthMm: t.lengthMm ?? null,
    widthMm: t.widthMm ?? null,
    heightMm: t.heightMm ?? null,
    wheelbaseMm: t.wheelbaseMm ?? null,
    trunkLiters: t.cargoVolumeM3 ? Math.round(Number(t.cargoVolumeM3) * 1000) : null,
    weightKg: t.curbWeightKg ?? null,
    bodyType: t.bodyType ?? null,
    driveType: t.driveWheels ?? null,
    transmission: t.transmission ?? null,
    batteryKwh: t.batteryCapacityKwPerH ?? null,
    electricRangeKm: t.electricRangeKm ?? null,
  };
}

// ── Cloudflare D1 REST API ───────────────────────────────────────────────────

async function d1Query(sql: string, params: any[] = []) {
  if (!CF_ACCOUNT_ID || !CF_API_TOKEN) {
    throw new Error('CF_ACCOUNT_ID and CF_API_TOKEN env vars required for D1 REST API');
  }
  const res = await fetch(
    `https://api.cloudflare.com/client/v4/accounts/${CF_ACCOUNT_ID}/d1/database/${D1_DATABASE_ID}/query`,
    {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${CF_API_TOKEN}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ sql, params }),
    }
  );
  const json: any = await res.json();
  if (!json.success) throw new Error(`D1 API error: ${JSON.stringify(json.errors)}`);
  return json.result;
}

async function upsertRow(make: string, model: string, generation: string | null, trim: string, year: number | null, specs: any) {
  const slug = makeCarSlug(make, model, trim, year);
  const specsJson = JSON.stringify(specs);
  const now = new Date().toISOString();
  await d1Query(
    `INSERT OR REPLACE INTO cars (make,model,generation,trim,year,slug,specs_json,updated_at) VALUES (?,?,?,?,?,?,?,?)`,
    [make, model, generation, trim, year, slug, specsJson, now]
  );
}

// ── Main ─────────────────────────────────────────────────────────────────────

async function seed() {
  // Verify D1 credentials
  if (!CF_ACCOUNT_ID || !CF_API_TOKEN) {
    console.error('Missing CF_ACCOUNT_ID or CF_API_TOKEN in .env');
    console.error('Add them to .env:');
    console.error('  CF_ACCOUNT_ID=your-account-id');
    console.error('  CF_API_TOKEN=your-api-token');
    process.exit(1);
  }

  console.log('Fetching makes from CarSpecsAPI...');
  const makes: any[] = await apiGet('/v2/cars/makes');
  let slice = SEED_MAKES
    ? makes.filter(m => SEED_MAKES.has(m.name))
    : MAX_MAKES > 0 ? makes.slice(0, MAX_MAKES) : makes;
  console.log(`Processing ${slice.length} of ${makes.length} makes`);

  let totalInserted = 0;
  let reqCount = 1;

  for (const make of slice) {
    console.log(`\n→ ${make.name}`);
    const models: any[] = await apiGet(`/v2/cars/makes/${make.id}/models`);
    reqCount++;

    for (const model of models) {
      const generations: any[] = await apiGet(`/v2/cars/models/${model.id}/generations`);
      reqCount++;

      let modelCount = 0;
      for (const gen of generations) {
        const trims: any[] = await apiGet(`/v2/cars/generations/${gen.id}/trims`);
        reqCount++;

        for (const trim of trims) {
          if (!trim.trim) continue;
          // Fetch full specs for this trim
          const detail = await apiGet(`/v2/cars/trims/${trim.id}`);
          reqCount++;
          const specs = specsFromTrim(detail);
          const year = detail.startProductionYear ?? null;
          await upsertRow(make.name, model.name, gen.name ?? null, trim.trim, year, specs);
          modelCount++;
          totalInserted++;
        }
      }
      console.log(`  ${model.name}: ${modelCount} trims (${reqCount} API reqs)`);
    }
  }

  // Verify
  const result = await d1Query('SELECT count(*) as total FROM cars');
  console.log(`\nDone. ${totalInserted} trims upserted. D1 total: ${result[0]?.results[0]?.total}`);
}

seed().catch(console.error);
