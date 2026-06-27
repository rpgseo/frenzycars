/// <reference types="@cloudflare/workers-types" />

// Access D1 binding from Astro locals at build time
export function getD1(locals: Record<string, any>): D1Database | null {
  return locals?.runtime?.env?.DB ?? null;
}

export interface CarRow {
  id: number;
  make: string;
  model: string;
  generation: string | null;
  trim: string;
  year: number | null;
  slug: string;
  specs_json: string;
  updated_at: string;
}

export interface ComparisonRow {
  id: number;
  slug_a: string;
  slug_b: string;
  url_slug: string;
  editorial: string | null;
  kd: number | null;
  monthly_searches: number | null;
  published: number;
  created_at: string;
  updated_at: string;
}

export interface CarSpecs {
  powerHp: number | null;
  torqueNm: number | null;
  displacementCc: number | null;
  acceleration0100: number | null;
  topSpeedKmh: number | null;
  fuelConsumptionCombined: number | null;
  co2: number | null;
  lengthMm: number | null;
  widthMm: number | null;
  heightMm: number | null;
  wheelbaseMm: number | null;
  trunkLiters: number | null;
  weightKg: number | null;
  bodyType: string | null;
  driveType: string | null;
  transmission: string | null;
  batteryKwh: number | null;
  electricRangeKm: number | null;
}

export function parseSpecs(specsJson: string): CarSpecs {
  try {
    return JSON.parse(specsJson) as CarSpecs;
  } catch {
    return {
      powerHp: null, torqueNm: null, displacementCc: null,
      acceleration0100: null, topSpeedKmh: null, fuelConsumptionCombined: null,
      co2: null, lengthMm: null, widthMm: null, heightMm: null,
      wheelbaseMm: null, trunkLiters: null, weightKg: null,
      bodyType: null, driveType: null, transmission: null,
      batteryKwh: null, electricRangeKm: null,
    };
  }
}
