import { execSync } from 'child_process';

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

function runD1(command: string): any[] {
  const out = execSync(
    `npx wrangler d1 execute frenzycars-cars --local --json --command="${command}"`,
    { encoding: 'utf8', cwd: process.cwd() }
  );
  const parsed = JSON.parse(out);
  return parsed[0]?.results ?? [];
}

export async function loadCompareIndex(): Promise<CompareIndex> {
  if (process.env.WRANGLER_D1_SKIP) return { cars: [], pairs: {}, metas: [] };
  try {
    const pairRows = runD1(
      'SELECT slug_a, slug_b FROM comparisons WHERE published=1'
    ) as PublishedPair[];
    if (pairRows.length === 0) return { cars: [], pairs: {}, metas: [] };

    const slugs = [...new Set(pairRows.flatMap(r => [r.slug_a, r.slug_b]))];
    const inList = slugs.map(s => `'${s}'`).join(',');
    const carRows = runD1(
      `SELECT slug, make, model, trim, year FROM cars WHERE slug IN (${inList})`
    ) as CarMeta[];

    return buildCompareIndex(pairRows, carRows);
  } catch (e) {
    console.warn('[compare-index] D1 unavailable, returning empty index.', e);
    return { cars: [], pairs: {}, metas: [] };
  }
}
