/**
 * Generates candidate car pairs from D1, queries DataForSEO for keyword volume
 * and difficulty, then inserts top 100 pairs (KD < 20, volume > 100, USA) into
 * the comparisons table with published=0.
 *
 * Usage: DATAFORSEO_LOGIN=xxx DATAFORSEO_PASSWORD=xxx npx tsx scripts/prioritize-comparisons.ts
 */

import { execSync } from 'node:child_process';
import { makeComparisonSlug } from '../src/lib/car-slug.js';

const DATAFORSEO_LOGIN = process.env.DATAFORSEO_LOGIN;
const DATAFORSEO_PASSWORD = process.env.DATAFORSEO_PASSWORD;
if (!DATAFORSEO_LOGIN || !DATAFORSEO_PASSWORD) {
  throw new Error('DATAFORSEO_LOGIN and DATAFORSEO_PASSWORD env vars required');
}

const auth = Buffer.from(`${DATAFORSEO_LOGIN}:${DATAFORSEO_PASSWORD}`).toString('base64');

interface CarRow {
  make: string;
  model: string;
  trim: string;
  year: number;
  slug: string;
}

interface KeywordResult {
  keyword: string;
  volume: number;
  kd: number;
}

async function getKeywordData(keywords: string[]): Promise<KeywordResult[]> {
  const res = await fetch('https://api.dataforseo.com/v3/dataforseo_labs/google/keyword_overview/live', {
    method: 'POST',
    headers: {
      'Authorization': `Basic ${auth}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(keywords.map(kw => ({
      keyword: kw,
      location_code: 2840, // USA
      language_code: 'en',
    }))),
  });
  const json = await res.json() as any;
  return (json.tasks?.[0]?.result ?? []).map((r: any) => ({
    keyword: r.keyword,
    volume: r.keyword_info?.search_volume ?? 0,
    kd: r.keyword_properties?.keyword_difficulty ?? 100,
  }));
}

function runWrangler(command: string): any {
  const stdout = execSync(
    `npx wrangler d1 execute frenzycars-cars --local --command ${JSON.stringify(command)} --json`,
    { encoding: 'utf8' }
  );
  return JSON.parse(stdout);
}

async function main() {
  // Read all cars from local D1 — query top 200 by year (recent models rank better)
  const out = runWrangler(
    'SELECT make, model, trim, year, slug FROM cars WHERE year >= 2020 ORDER BY year DESC LIMIT 200'
  );
  const cars: CarRow[] = out[0]?.results ?? [];

  // Generate pairs (same year window ±2)
  const pairs: Array<{ a: CarRow; b: CarRow }> = [];
  for (let i = 0; i < cars.length; i++) {
    for (let j = i + 1; j < cars.length; j++) {
      const yearDiff = Math.abs((cars[i].year ?? 0) - (cars[j].year ?? 0));
      if (yearDiff <= 2) pairs.push({ a: cars[i], b: cars[j] });
      if (pairs.length >= 500) break; // cap candidates
    }
    if (pairs.length >= 500) break;
  }

  console.log(`Generated ${pairs.length} candidate pairs`);

  // Query DataForSEO in batches of 100
  const results: Array<{ urlSlug: string; slugA: string; slugB: string; kd: number; volume: number }> = [];
  const BATCH = 100;

  for (let i = 0; i < pairs.length; i += BATCH) {
    const chunk = pairs.slice(i, i + BATCH);
    const keywords = chunk.map(p =>
      `${p.a.make} ${p.a.model} ${p.a.trim} ${p.a.year} vs ${p.b.make} ${p.b.model} ${p.b.trim} ${p.b.year}`
    );
    const data = await getKeywordData(keywords);

    for (let k = 0; k < chunk.length; k++) {
      const kd_data = data[k];
      if (!kd_data) continue;
      if (kd_data.volume < 100 || kd_data.kd >= 20) continue;
      const [sA, sB] = [chunk[k].a.slug, chunk[k].b.slug].sort();
      results.push({
        urlSlug: makeComparisonSlug(sA, sB),
        slugA: sA,
        slugB: sB,
        kd: kd_data.kd,
        volume: kd_data.volume,
      });
    }
    console.log(`Processed batch ${i}–${i + BATCH}, ${results.length} valid pairs so far`);
  }

  // Sort by KD ASC, take top 100
  results.sort((a, b) => a.kd - b.kd);
  const top = results.slice(0, 100);
  console.log(`Inserting ${top.length} prioritized pairs into D1`);

  const now = new Date().toISOString();
  for (const pair of top) {
    runWrangler(
      `INSERT OR IGNORE INTO comparisons (slug_a,slug_b,url_slug,kd,monthly_searches,published,created_at,updated_at) VALUES ('${pair.slugA}','${pair.slugB}','${pair.urlSlug}',${pair.kd},${pair.volume},0,'${now}','${now}')`
    );
  }

  console.log('Done. Run the seed:editorial script next to generate editorial for each pair.');
}

main().catch(console.error);
