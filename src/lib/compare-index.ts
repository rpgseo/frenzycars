export interface CarMeta {
  slug: string;
  make: string;
  model: string;
  trim: string;
  year: number | null;
}

export interface PublishedPair {
  slug_a: string;
  slug_b: string;
}

export interface CarOption {
  slug: string;
  label: string;
  make: string;
}

export interface CompareIndex {
  cars: CarOption[];
  pairs: Record<string, string[]>;
  metas: CarMeta[];
}

export function carLabel(c: CarMeta): string {
  const base = `${c.make} ${c.model} ${c.trim}`.trim();
  return c.year ? `${base} (${c.year})` : base;
}

export function buildCompareIndex(rows: PublishedPair[], cars: CarMeta[]): CompareIndex {
  const carBySlug = new Map(cars.map(c => [c.slug, c]));
  const pairs: Record<string, string[]> = {};
  const usedSlugs = new Set<string>();

  const addEdge = (from: string, to: string) => {
    if (!carBySlug.has(from) || !carBySlug.has(to)) return;
    (pairs[from] ??= []).push(to);
    usedSlugs.add(from);
    usedSlugs.add(to);
  };

  for (const row of rows) {
    addEdge(row.slug_a, row.slug_b);
    addEdge(row.slug_b, row.slug_a);
  }

  for (const slug of Object.keys(pairs)) {
    pairs[slug] = [...new Set(pairs[slug])].sort();
  }

  const usedMetas = cars.filter(c => usedSlugs.has(c.slug));

  const carOptions: CarOption[] = usedMetas
    .map(c => ({ slug: c.slug, label: carLabel(c), make: c.make }))
    .sort((a, b) => a.label.localeCompare(b.label));

  return { cars: carOptions, pairs, metas: usedMetas };
}

const CF_ACCOUNT_ID = (typeof import.meta !== 'undefined' ? import.meta.env?.CF_ACCOUNT_ID : undefined) ?? process.env.CF_ACCOUNT_ID;
const CF_API_TOKEN = (typeof import.meta !== 'undefined' ? import.meta.env?.CF_API_TOKEN : undefined) ?? process.env.CF_API_TOKEN;
const D1_DATABASE_ID = 'b9d5f455-8e9e-439c-9283-ef1b19addf4b';

async function d1Query(sql: string, params: any[] = []): Promise<any[]> {
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

export async function loadCompareIndex(): Promise<CompareIndex> {
  if (process.env.WRANGLER_D1_SKIP) return { cars: [], pairs: {}, metas: [] };
  try {
    const pairRows = await d1Query(
      'SELECT slug_a, slug_b FROM comparisons WHERE published=1'
    ) as PublishedPair[];
    if (pairRows.length === 0) return { cars: [], pairs: {}, metas: [] };

    const slugs = [...new Set(pairRows.flatMap(r => [r.slug_a, r.slug_b]))];
    const placeholders = slugs.map(() => '?').join(',');
    const carRows = await d1Query(
      `SELECT slug, make, model, trim, year FROM cars WHERE slug IN (${placeholders})`,
      slugs
    ) as CarMeta[];

    return buildCompareIndex(pairRows, carRows);
  } catch (e) {
    console.warn('[compare-index] D1 unavailable, returning empty index.', e);
    return { cars: [], pairs: {}, metas: [] };
  }
}
