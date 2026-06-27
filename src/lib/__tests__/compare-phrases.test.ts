import { describe, it, expect } from 'vitest';
import { generatePhrases } from '../compare-phrases.js';
import type { CarRow } from '../d1-client.js';

const civic: CarRow = {
  id: 1, make: 'Honda', model: 'Civic', generation: null, trim: 'Si', year: 2023,
  slug: 'honda-civic-si-2023', updated_at: '2026-01-01',
  specs_json: JSON.stringify({
    powerHp: 200, torqueNm: 260, displacementCc: 1500, acceleration0100: 6.8,
    topSpeedKmh: 230, fuelConsumptionCombined: 7.5, co2: null,
    lengthMm: 4674, widthMm: 1802, heightMm: 1415, wheelbaseMm: 2735,
    trunkLiters: 410, weightKg: 1390, bodyType: 'Sedan',
    driveType: 'FWD', transmission: 'Manual', batteryKwh: null, electricRangeKm: null,
  }),
};

const gti: CarRow = {
  id: 2, make: 'Volkswagen', model: 'Golf GTI', generation: null, trim: 'Base', year: 2023,
  slug: 'volkswagen-golf-gti-base-2023', updated_at: '2026-01-01',
  specs_json: JSON.stringify({
    powerHp: 241, torqueNm: 370, displacementCc: 2000, acceleration0100: 6.3,
    topSpeedKmh: 250, fuelConsumptionCombined: 8.1, co2: null,
    lengthMm: 4284, widthMm: 1789, heightMm: 1452, wheelbaseMm: 2637,
    trunkLiters: 374, weightKg: 1460, bodyType: 'Hatchback',
    driveType: 'FWD', transmission: 'DSG', batteryKwh: null, electricRangeKm: null,
  }),
};

describe('generatePhrases', () => {
  it('returns at least 5 phrases', () => {
    const phrases = generatePhrases(civic, gti);
    expect(phrases.length).toBeGreaterThanOrEqual(5);
  });

  it('each phrase is a non-empty string', () => {
    const phrases = generatePhrases(civic, gti);
    phrases.forEach(p => expect(p.length).toBeGreaterThan(0));
  });

  it('throws when cars have insufficient spec data', () => {
    const sparse: CarRow = { ...civic, specs_json: JSON.stringify({ powerHp: null }) };
    expect(() => generatePhrases(sparse, sparse)).toThrow('only');
  });
});
