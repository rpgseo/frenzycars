import { describe, it, expect } from 'vitest';
import { buildCompareIndex, carLabel } from '../compare-index.js';

const cars = [
  { slug: 'honda-civic-si-2023', make: 'Honda', model: 'Civic', trim: 'Si', year: 2023 },
  { slug: 'volkswagen-golf-gti-base-2023', make: 'Volkswagen', model: 'Golf', trim: 'GTI Base', year: 2023 },
  { slug: 'ac-ace-roadster', make: 'AC', model: 'ACE', trim: 'Roadster', year: null },
];

const pairs = [
  { slug_a: 'honda-civic-si-2023', slug_b: 'volkswagen-golf-gti-base-2023' },
];

describe('carLabel', () => {
  it('formats make model trim with year in parens', () => {
    expect(carLabel(cars[0])).toBe('Honda Civic Si (2023)');
  });

  it('omits the year parens when year is null', () => {
    expect(carLabel(cars[2])).toBe('AC ACE Roadster');
  });
});

describe('buildCompareIndex', () => {
  it('includes only cars that appear in a published pair', () => {
    const idx = buildCompareIndex(pairs, cars);
    const slugs = idx.cars.map(c => c.slug).sort();
    expect(slugs).toEqual(['honda-civic-si-2023', 'volkswagen-golf-gti-base-2023']);
  });

  it('builds a symmetric adjacency map', () => {
    const idx = buildCompareIndex(pairs, cars);
    expect(idx.pairs['honda-civic-si-2023']).toEqual(['volkswagen-golf-gti-base-2023']);
    expect(idx.pairs['volkswagen-golf-gti-base-2023']).toEqual(['honda-civic-si-2023']);
  });

  it('returns CarOption objects with slug, label, make', () => {
    const idx = buildCompareIndex(pairs, cars);
    const honda = idx.cars.find(c => c.slug === 'honda-civic-si-2023')!;
    expect(honda).toEqual({
      slug: 'honda-civic-si-2023',
      label: 'Honda Civic Si (2023)',
      make: 'Honda',
    });
  });

  it('returns an empty index when there are no pairs', () => {
    expect(buildCompareIndex([], cars)).toEqual({ cars: [], pairs: {} });
  });
});
