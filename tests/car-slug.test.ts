import { describe, it, expect } from 'vitest';
import { makeCarSlug, makeComparisonSlug } from '../src/lib/car-slug';

describe('makeCarSlug', () => {
  it('produces a slug from make/model/trim/year', () => {
    expect(makeCarSlug('Toyota', 'Corolla', 'SE', 2023)).toBe('toyota-corolla-se-2023');
  });

  it('handles null year', () => {
    expect(makeCarSlug('BMW', 'M3', 'Competition', null)).toBe('bmw-m3-competition');
  });

  it('normalises accents and special chars', () => {
    expect(makeCarSlug('Citroën', 'C3', 'Shine', 2022)).toBe('citroen-c3-shine-2022');
  });

  it('truncates to 80 chars', () => {
    const result = makeCarSlug('A'.repeat(30), 'B'.repeat(30), 'C'.repeat(30), 2020);
    expect(result.length).toBeLessThanOrEqual(80);
  });
});

describe('makeComparisonSlug', () => {
  it('sorts slugs alphabetically', () => {
    expect(makeComparisonSlug('toyota-camry-2023', 'bmw-3-series-2023')).toBe(
      'bmw-3-series-2023-vs-toyota-camry-2023'
    );
  });

  it('is idempotent regardless of order', () => {
    const a = makeComparisonSlug('slug-a', 'slug-b');
    const b = makeComparisonSlug('slug-b', 'slug-a');
    expect(a).toBe(b);
  });
});
