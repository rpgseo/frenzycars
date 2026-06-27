import { slugifyTag } from './slugify.js';

export function makeCarSlug(make: string, model: string, trim: string, year: number | null): string {
  const parts = [make, model, trim, year ? String(year) : ''].filter(Boolean);
  return slugifyTag(parts.join(' ')).slice(0, 80);
}

export function makeComparisonSlug(slugA: string, slugB: string): string {
  // alphabetical order to avoid duplicate canonical pages
  const [a, b] = [slugA, slugB].sort();
  return `${a}-vs-${b}`.slice(0, 120);
}
