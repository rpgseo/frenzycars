import type { CarSpecs } from './d1-client.js';

export interface RadarData {
  power: number;
  efficiency: number;
  practicality: number;
  performance: number;
  comfort: number;
  value: number;
}

export function scoreSpecs(specs: CarSpecs, peer: CarSpecs): RadarData {
  function ratio(mine: number | null, theirs: number | null, higherIsBetter = true): number {
    if (!mine || !theirs) return 50;
    const r = higherIsBetter ? mine / (mine + theirs) : theirs / (mine + theirs);
    return Math.round(r * 100);
  }

  return {
    power: ratio(specs.powerHp, peer.powerHp),
    efficiency: ratio(specs.fuelConsumptionCombined, peer.fuelConsumptionCombined, false),
    practicality: ratio(specs.trunkLiters, peer.trunkLiters),
    performance: ratio(specs.acceleration0100, peer.acceleration0100, false),
    comfort: ratio(specs.wheelbaseMm, peer.wheelbaseMm),
    value: 50, // placeholder — price data not in CarSpecs
  };
}

export function overallScore(radar: RadarData): number {
  const vals = Object.values(radar);
  return Math.round(vals.reduce((a, b) => a + b, 0) / vals.length);
}
