// @vitest-environment jsdom
import { describe, it, expect } from 'vitest';
import { targetHref, optionsForB } from '../CompareSelector.js';

const cars = [
  { slug: 'honda-civic-si-2023', label: 'Honda Civic Si (2023)', make: 'Honda' },
  { slug: 'volkswagen-golf-gti-base-2023', label: 'Volkswagen Golf GTI Base (2023)', make: 'Volkswagen' },
  { slug: 'audi-a3-2023', label: 'Audi A3 (2023)', make: 'Audi' },
];
const pairs = {
  'honda-civic-si-2023': ['volkswagen-golf-gti-base-2023'],
  'volkswagen-golf-gti-base-2023': ['honda-civic-si-2023'],
};

describe('targetHref', () => {
  it('builds an alphabetical comparison URL with trailing slash', () => {
    expect(targetHref('honda-civic-si-2023', 'volkswagen-golf-gti-base-2023'))
      .toBe('/comparar/honda-civic-si-2023-vs-volkswagen-golf-gti-base-2023/');
  });

  it('is order-independent (same URL regardless of argument order)', () => {
    const x = targetHref('honda-civic-si-2023', 'volkswagen-golf-gti-base-2023');
    const y = targetHref('volkswagen-golf-gti-base-2023', 'honda-civic-si-2023');
    expect(x).toBe(y);
  });
});

describe('optionsForB', () => {
  it('returns only cars paired with A', () => {
    const opts = optionsForB(pairs, 'honda-civic-si-2023', cars);
    expect(opts.map(o => o.slug)).toEqual(['volkswagen-golf-gti-base-2023']);
  });

  it('returns an empty array when A has no pairs', () => {
    expect(optionsForB(pairs, 'audi-a3-2023', cars)).toEqual([]);
  });

  it('returns an empty array when A is empty', () => {
    expect(optionsForB(pairs, '', cars)).toEqual([]);
  });
});
