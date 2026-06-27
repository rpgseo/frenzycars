/**
 * Cloudflare Worker that runs every Sunday at 03:00 UTC.
 * Fetches all makes from CarSpecsAPI, then fetches models updated
 * since the last sync, and upserts into D1.
 * Deploy with: npx wrangler deploy workers/cron-sync-cars.ts
 */

export interface Env {
  DB: D1Database;
  RAPIDAPI_KEY: string;
}

const BASE = 'https://car-specs.p.rapidapi.com/v2/cars';

async function apiGet(path: string, key: string) {
  const res = await fetch(`${BASE}${path}`, {
    headers: { 'x-rapidapi-host': 'car-specs.p.rapidapi.com', 'x-rapidapi-key': key },
  });
  if (!res.ok) throw new Error(`API ${path} → ${res.status}`);
  return res.json() as Promise<any>;
}

export default {
  async scheduled(_event: ScheduledEvent, env: Env, _ctx: ExecutionContext) {
    const makes = await apiGet('/makes', env.RAPIDAPI_KEY);
    const now = new Date().toISOString();
    let upserted = 0;

    for (const make of makes.data ?? []) {
      const models = await apiGet(`/makes/${make.id}/models`, env.RAPIDAPI_KEY);
      for (const model of models.data ?? []) {
        const gens = await apiGet(`/models/${model.id}/generations`, env.RAPIDAPI_KEY);
        for (const gen of gens.data ?? []) {
          const trims = await apiGet(`/generations/${gen.id}/trims`, env.RAPIDAPI_KEY);
          for (const trim of trims.data ?? []) {
            const details = await apiGet(`/trims/${trim.id}`, env.RAPIDAPI_KEY);
            const specs = {
              powerHp: details.engineHp ?? null,
              torqueNm: details.maximumTorqueNM ?? null,
              displacementCc: details.capacityCm3 ?? null,
              acceleration0100: details.acceleration0To100KmPerHS ?? null,
              topSpeedKmh: details.topSpeedKmH ?? null,
              fuelConsumptionCombined: details.fuelConsumptionCombinedL100Km ?? null,
              co2: details.co2EmissionsGKm ?? null,
              lengthMm: details.lengthMm ?? null,
              widthMm: details.widthMm ?? null,
              heightMm: details.heightMm ?? null,
              wheelbaseMm: details.wheelbaseMm ?? null,
              trunkLiters: details.cargoVolumeM3 ? Math.round(details.cargoVolumeM3 * 1000) : null,
              weightKg: details.curbWeightKg ?? null,
              bodyType: details.bodyType ?? null,
              driveType: details.driveWheels ?? null,
              transmission: details.transmission ?? null,
              batteryKwh: details.batteryCapacityKwPerH ?? null,
              electricRangeKm: details.electricRangeKm ?? null,
            };
            const slug = [make.name, model.name, trim.name, trim.year]
              .filter(Boolean).join('-')
              .toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '')
              .slice(0, 80);

            await env.DB.prepare(
              `INSERT OR REPLACE INTO cars (make,model,generation,trim,year,slug,specs_json,updated_at)
               VALUES (?,?,?,?,?,?,?,?)`
            ).bind(
              make.name, model.name, gen.name ?? null, trim.name,
              trim.year ? Number(trim.year) : null,
              slug, JSON.stringify(specs), now
            ).run();
            upserted++;
          }
        }
      }
    }
    console.log(`Cron sync complete: upserted ${upserted} cars at ${now}`);
  },
};
