import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import yaml from 'js-yaml';

// During Astro build, process.cwd() is the astro/ project root (where package.json lives).
// The data files live at astro/src/data/ relative to that.
const dataDir = join(process.cwd(), 'src', 'data');

export interface MaintenancePage {
  id: string;
  title: string;
  [k: string]: any;
}

function differentiators(row: any): number {
  let d = 0;
  if ((row.causes?.length ?? 0) >= 2) d++;
  if ((row.steps?.length ?? 0) >= 2) d++;
  if ((row.when_to_see_mechanic?.length ?? 0) >= 2) d++;
  if (row.typical_cost) d++;
  if (row.is_emergency) d++;
  if ((row.picks?.length ?? 0) >= 3) d += 2;
  if (row.contenders && Object.keys(row.contenders).length > 0) d += 3;
  if ((row.products?.length ?? 0) >= 3) d += 2;
  return d;
}

export function loadMaintenancePages(): MaintenancePage[] {
  const rows: any[] = yaml.load(
    readFileSync(join(dataDir, 'troubleshooting.yaml'), 'utf8')
  ) as any[];
  const prodData: any =
    yaml.load(readFileSync(join(dataDir, 'products.yaml'), 'utf8')) || {};
  const pages: MaintenancePage[] = [];
  for (const row of rows) {
    if (differentiators(row) < 3) continue; // anti-thin gate
    const products = (row.products ?? []).map((prod: any) => {
      const pid = prod.id ?? '';
      const enriched = prodData?.[row.id]?.[pid] ?? {};
      return { ...enriched, ...prod };
    });
    pages.push({ ...row, title: row.question, products });
  }
  return pages;
}
