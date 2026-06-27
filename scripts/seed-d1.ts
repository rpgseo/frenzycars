import Papa from 'papaparse';
import { execSync } from 'child_process';
import { writeFileSync, unlinkSync } from 'fs';
import { makeCarSlug } from '../src/lib/car-slug.js';

const RAPIDAPI_KEY = process.env.RAPIDAPI_KEY;
if (!RAPIDAPI_KEY) throw new Error('RAPIDAPI_KEY env var required');

interface CsvRow {
  make?: string;
  model?: string;
  generation?: string;
  trim?: string;
  year?: string;
  engineHp?: string;
  maximumTorqueNM?: string;
  capacityCm3?: string;
  acceleration0To100KmPerHS?: string;
  topSpeedKmH?: string;
  fuelConsumptionCombinedL100Km?: string;
  co2EmissionsGKm?: string;
  lengthMm?: string;
  widthMm?: string;
  heightMm?: string;
  wheelbaseMm?: string;
  cargoVolumeM3?: string;
  curbWeightKg?: string;
  bodyType?: string;
  driveWheels?: string;
  transmission?: string;
  batteryCapacityKwPerH?: string;
  electricRangeKm?: string;
  [key: string]: string | undefined;
}

async function downloadCsv(): Promise<string> {
  console.log('Downloading CSV from CarSpecsAPI...');
  const res = await fetch('https://car-specs.p.rapidapi.com/v2/cars/download-database', {
    headers: {
      'x-rapidapi-host': 'car-specs.p.rapidapi.com',
      'x-rapidapi-key': RAPIDAPI_KEY!,
    },
  });
  if (!res.ok) throw new Error(`CarSpecsAPI error: ${res.status} ${res.statusText}`);
  return res.text();
}

function rowToSpecs(row: CsvRow) {
  return {
    powerHp: row.engineHp ? Number(row.engineHp) : null,
    torqueNm: row.maximumTorqueNM ? Number(row.maximumTorqueNM) : null,
    displacementCc: row.capacityCm3 ? Number(row.capacityCm3) : null,
    acceleration0100: row.acceleration0To100KmPerHS ? Number(row.acceleration0To100KmPerHS) : null,
    topSpeedKmh: row.topSpeedKmH ? Number(row.topSpeedKmH) : null,
    fuelConsumptionCombined: row.fuelConsumptionCombinedL100Km ? Number(row.fuelConsumptionCombinedL100Km) : null,
    co2: row.co2EmissionsGKm ? Number(row.co2EmissionsGKm) : null,
    lengthMm: row.lengthMm ? Number(row.lengthMm) : null,
    widthMm: row.widthMm ? Number(row.widthMm) : null,
    heightMm: row.heightMm ? Number(row.heightMm) : null,
    wheelbaseMm: row.wheelbaseMm ? Number(row.wheelbaseMm) : null,
    trunkLiters: row.cargoVolumeM3 ? Math.round(Number(row.cargoVolumeM3) * 1000) : null,
    weightKg: row.curbWeightKg ? Number(row.curbWeightKg) : null,
    bodyType: row.bodyType ?? null,
    driveType: row.driveWheels ?? null,
    transmission: row.transmission ?? null,
    batteryKwh: row.batteryCapacityKwPerH ? Number(row.batteryCapacityKwPerH) : null,
    electricRangeKm: row.electricRangeKm ? Number(row.electricRangeKm) : null,
  };
}

async function seed() {
  const csv = await downloadCsv();
  const { data } = Papa.parse<CsvRow>(csv, { header: true, skipEmptyLines: true });
  console.log(`Parsed ${data.length} rows`);

  const now = new Date().toISOString();
  let inserted = 0;
  const BATCH = 100;

  for (let i = 0; i < data.length; i += BATCH) {
    const chunk = data.slice(i, i + BATCH);
    const values = chunk
      .filter(r => r.make && r.model && r.trim)
      .map(r => {
        const slug = makeCarSlug(r.make!, r.model!, r.trim!, r.year ? Number(r.year) : null);
        const specs = JSON.stringify(rowToSpecs(r));
        const year = r.year ? Number(r.year) : 'NULL';
        const gen = r.generation ? `'${r.generation.replace(/'/g, "''")}'` : 'NULL';
        return `('${r.make!.replace(/'/g, "''")}','${r.model!.replace(/'/g, "''")}',${gen},'${r.trim!.replace(/'/g, "''")}',${year},'${slug}','${specs.replace(/'/g, "''")}','${now}')`;
      })
      .join(',\n');

    if (!values) continue;

    const sql = `INSERT OR REPLACE INTO cars (make,model,generation,trim,year,slug,specs_json,updated_at) VALUES\n${values};`;
    const sqlFile = `seed_batch_${i}.sql`;
    writeFileSync(sqlFile, sql, 'utf8');

    try {
      execSync(`npx wrangler d1 execute frenzycars-cars --local --file=${sqlFile}`, { stdio: 'inherit' });
    } finally {
      unlinkSync(sqlFile);
    }

    inserted += chunk.length;
    if (i % 5000 === 0) console.log(`Progress: ${inserted}/${data.length}`);
  }
  console.log(`Done. Inserted/replaced ${inserted} cars.`);
}

seed().catch(console.error);
