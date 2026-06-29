import { existsSync, writeFileSync, unlinkSync } from 'fs';
import { config } from 'dotenv';
import { execSync } from 'child_process';
import { join } from 'path';
import { tmpdir } from 'os';
if (existsSync('.env')) config();

const CF_ACCOUNT_ID = process.env.CF_ACCOUNT_ID;
const CF_API_TOKEN = process.env.CF_API_TOKEN;
const D1_DATABASE_ID = 'b9d5f455-8e9e-439c-9283-ef1b19addf4b';
const REMOTE = process.argv.includes('--remote');

function sq(v: string | null): string {
  if (v === null) return 'NULL';
  return `'${v.replace(/'/g, "''")}'`;
}
function num(v: number | null): string {
  return v === null ? 'NULL' : String(v);
}

async function d1ExecuteSql(sql: string): Promise<void> {
  const tmpFile = join(tmpdir(), `seed-candidates-${Date.now()}.sql`);
  writeFileSync(tmpFile, sql, 'utf8');
  try {
    if (!REMOTE) {
      execSync(`npx wrangler d1 execute frenzycars-cars --local --file="${tmpFile}" --yes`, {
        stdio: 'inherit',
        cwd: process.cwd(),
      });
    } else {
      if (!CF_ACCOUNT_ID || !CF_API_TOKEN) {
        throw new Error('CF_ACCOUNT_ID and CF_API_TOKEN required for --remote');
      }
      const res = await fetch(
        `https://api.cloudflare.com/client/v4/accounts/${CF_ACCOUNT_ID}/d1/database/${D1_DATABASE_ID}/query`,
        {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${CF_API_TOKEN}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ sql }),
        }
      );
      if (!res.ok) {
        const text = await res.text();
        throw new Error(`D1 query failed: ${res.status} ${text}`);
      }
    }
  } finally {
    unlinkSync(tmpFile);
  }
}

const now = new Date().toISOString();

const candidates = [
  {
    make: 'Porsche', model: '911 GT3', year: 2024, slug: 'porsche-911-gt3-2024',
    keyword: 'porsche 911 gt3 review', search_volume: 8100, keyword_difficulty: 58, trend_score: 91,
    status: 'suggested',
    reference_image_url: null, editorial_hero_url: null,
    editorial_mid1_url: null, editorial_mid2_url: null, video_url: null,
    hero_prompt: null, mid_prompt: null, video_prompt: null, raw_data: null,
  },
  {
    make: 'Ferrari', model: 'SF90 Stradale', year: 2024, slug: 'ferrari-sf90-stradale-2024',
    keyword: 'ferrari sf90 stradale review', search_volume: 6600, keyword_difficulty: 61, trend_score: 88,
    status: 'approved',
    reference_image_url: 'https://images.frenzycars.com/press/ferrari/ferrari-sf90-stradale-base-2021/hero.webp',
    editorial_hero_url: null,
    editorial_mid1_url: null, editorial_mid2_url: null, video_url: null,
    hero_prompt: 'A Ferrari SF90 Stradale shot as a dramatic automotive advertisement — dark stormy sky, low angle, rim lighting, motion blur on background, photorealistic, editorial magazine cover',
    mid_prompt: null, video_prompt: null,
    raw_data: JSON.stringify({ power_hp: 986, torque_nm: 800, zero_to_100: 2.5, top_speed_kmh: 340, weight_kg: 1570 }),
  },
  {
    make: 'Lamborghini', model: 'Huracán EVO', year: 2023, slug: 'lamborghini-huracan-evo-2023',
    keyword: 'lamborghini huracan evo review', search_volume: 5400, keyword_difficulty: 55, trend_score: 79,
    status: 'rejected',
    reference_image_url: null, editorial_hero_url: null,
    editorial_mid1_url: null, editorial_mid2_url: null, video_url: null,
    hero_prompt: null, mid_prompt: null, video_prompt: null, raw_data: null,
  },
  {
    make: 'BMW', model: 'M3 Competition', year: 2024, slug: 'bmw-m3-competition-2024',
    keyword: 'bmw m3 competition review 2024', search_volume: 12100, keyword_difficulty: 49, trend_score: 94,
    status: 'published',
    reference_image_url: 'https://images.frenzycars.com/press/bmw/bmw-m3-competition-2024/hero.webp',
    editorial_hero_url: 'https://images.frenzycars.com/editorial/bmw/bmw-m3-competition-2024/hero.webp',
    editorial_mid1_url: 'https://images.frenzycars.com/editorial/bmw/bmw-m3-competition-2024/mid-1.webp',
    editorial_mid2_url: 'https://images.frenzycars.com/editorial/bmw/bmw-m3-competition-2024/mid-2.webp',
    video_url: null,
    hero_prompt: 'BMW M3 Competition — cinematic car advertisement, night cityscape, streaking lights, aggressive low angle, deep blue paint, editorial magazine style, photorealistic',
    mid_prompt: 'BMW M3 Competition interior detail shot — carbon trim, M steering wheel, ambient lighting, dark studio, editorial automotive photography',
    video_prompt: null,
    raw_data: JSON.stringify({ power_hp: 510, torque_nm: 650, zero_to_100: 3.5, top_speed_kmh: 290, weight_kg: 1750 }),
  },
  {
    make: 'Mercedes-AMG', model: 'GT 63 S', year: 2024, slug: 'mercedes-amg-gt63s-2024',
    keyword: null, search_volume: null, keyword_difficulty: null, trend_score: null,
    status: 'suggested',
    reference_image_url: null, editorial_hero_url: null,
    editorial_mid1_url: null, editorial_mid2_url: null, video_url: null,
    hero_prompt: null, mid_prompt: null, video_prompt: null, raw_data: null,
  },
];

async function seed() {
  console.log(`\nSeeding ${candidates.length} review candidates (${REMOTE ? 'remote' : 'local'})...\n`);

  for (const c of candidates) {
    const sql = `INSERT OR REPLACE INTO review_candidates
  (make, model, year, slug, keyword, search_volume, keyword_difficulty, trend_score,
   reference_image_url, editorial_hero_url, editorial_mid1_url, editorial_mid2_url,
   video_url, hero_prompt, mid_prompt, video_prompt, raw_data, status, created_at, updated_at)
VALUES (
  ${sq(c.make)}, ${sq(c.model)}, ${num(c.year ?? null)}, ${sq(c.slug)},
  ${sq(c.keyword ?? null)}, ${num(c.search_volume ?? null)}, ${num(c.keyword_difficulty ?? null)}, ${num(c.trend_score ?? null)},
  ${sq(c.reference_image_url)}, ${sq(c.editorial_hero_url)},
  ${sq(c.editorial_mid1_url)}, ${sq(c.editorial_mid2_url)},
  ${sq(c.video_url ?? null)},
  ${sq(c.hero_prompt ?? null)}, ${sq(c.mid_prompt ?? null)}, ${sq(c.video_prompt ?? null)},
  ${sq(c.raw_data ?? null)},
  ${sq(c.status)}, ${sq(now)}, ${sq(now)}
);`;

    await d1ExecuteSql(sql);
    console.log(`  ✓ ${c.make} ${c.model} (${c.status})`);
  }

  console.log('\nDone.\n');
}

seed().catch(e => { console.error(e); process.exit(1); });
