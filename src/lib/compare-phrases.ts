import type { CarRow } from './d1-client.js';
import { parseSpecs } from './d1-client.js';

export function generatePhrases(a: CarRow, b: CarRow): string[] {
  const sa = parseSpecs(a.specs_json);
  const sb = parseSpecs(b.specs_json);
  const phrases: string[] = [];

  function pct(va: number, vb: number) { return Math.abs(Math.round((va - vb) / vb * 100)); }

  // Power
  if (sa.powerHp && sb.powerHp && Math.abs(sa.powerHp - sb.powerHp) > 10) {
    const [winner, loser] = sa.powerHp > sb.powerHp ? [a, b] : [b, a];
    const [ws, ls] = sa.powerHp > sb.powerHp ? [sa, sb] : [sb, sa];
    phrases.push(`The ${winner.make} ${winner.model} puts out ${Math.abs(ws.powerHp! - ls.powerHp!)} more horsepower (${ws.powerHp} hp vs ${ls.powerHp} hp).`);
  }

  // Acceleration
  if (sa.acceleration0100 && sb.acceleration0100 && Math.abs(sa.acceleration0100 - sb.acceleration0100) > 0.2) {
    const [faster, slower] = sa.acceleration0100 < sb.acceleration0100 ? [a, b] : [b, a];
    const [fs, ss] = sa.acceleration0100 < sb.acceleration0100 ? [sa, sb] : [sb, sa];
    phrases.push(`The ${faster.make} ${faster.model} hits 0–60 mph ${Math.abs(fs.acceleration0100! - ss.acceleration0100!).toFixed(1)} seconds faster (${fs.acceleration0100}s vs ${ss.acceleration0100}s).`);
  }

  // Weight
  if (sa.weightKg && sb.weightKg && Math.abs(sa.weightKg - sb.weightKg) > 50) {
    const [lighter, heavier] = sa.weightKg < sb.weightKg ? [a, b] : [b, a];
    const [lw, hw] = sa.weightKg < sb.weightKg ? [sa, sb] : [sb, sa];
    const p = pct(hw.weightKg!, lw.weightKg!);
    phrases.push(`The ${lighter.make} ${lighter.model} is ${Math.abs(lw.weightKg! - hw.weightKg!)} kg lighter — ${p}% less weight to push around.`);
  }

  // Fuel consumption
  if (sa.fuelConsumptionCombined && sb.fuelConsumptionCombined && Math.abs(sa.fuelConsumptionCombined - sb.fuelConsumptionCombined) > 0.5) {
    const [efficient, thirsty] = sa.fuelConsumptionCombined < sb.fuelConsumptionCombined ? [a, b] : [b, a];
    const [es, ts] = sa.fuelConsumptionCombined < sb.fuelConsumptionCombined ? [sa, sb] : [sb, sa];
    phrases.push(`The ${efficient.make} ${efficient.model} is more fuel-efficient at ${es.fuelConsumptionCombined}L/100km combined vs ${ts.fuelConsumptionCombined}L/100km.`);
  }

  // Trunk
  if (sa.trunkLiters && sb.trunkLiters && Math.abs(sa.trunkLiters - sb.trunkLiters) > 30) {
    const [bigger, smaller] = sa.trunkLiters > sb.trunkLiters ? [a, b] : [b, a];
    const [bs, ss] = sa.trunkLiters > sb.trunkLiters ? [sa, sb] : [sb, sa];
    phrases.push(`The ${bigger.make} ${bigger.model} offers ${Math.abs(bs.trunkLiters! - ss.trunkLiters!)} more liters of cargo space (${bs.trunkLiters}L vs ${ss.trunkLiters}L).`);
  }

  // Top speed
  if (sa.topSpeedKmh && sb.topSpeedKmh && Math.abs(sa.topSpeedKmh - sb.topSpeedKmh) > 10) {
    const [faster] = sa.topSpeedKmh > sb.topSpeedKmh ? [a, b] : [b, a];
    const [fs, ss] = sa.topSpeedKmh > sb.topSpeedKmh ? [sa, sb] : [sb, sa];
    phrases.push(`The ${faster.make} ${faster.model} has a higher top speed: ${fs.topSpeedKmh} km/h vs ${ss.topSpeedKmh} km/h.`);
  }

  // EV range
  if (sa.electricRangeKm && sb.electricRangeKm && Math.abs(sa.electricRangeKm - sb.electricRangeKm) > 20) {
    const [longer, shorter] = sa.electricRangeKm > sb.electricRangeKm ? [a, b] : [b, a];
    const [ls2, ss2] = sa.electricRangeKm > sb.electricRangeKm ? [sa, sb] : [sb, sa];
    phrases.push(`The ${longer.make} ${longer.model} goes ${Math.abs(ls2.electricRangeKm! - ss2.electricRangeKm!)} km further on a single charge (${ls2.electricRangeKm} km vs ${ss2.electricRangeKm} km).`);
  }

  // Torque
  if (sa.torqueNm && sb.torqueNm && Math.abs(sa.torqueNm - sb.torqueNm) > 20) {
    const [torquier, less] = sa.torqueNm > sb.torqueNm ? [a, b] : [b, a];
    const [ts2, ls3] = sa.torqueNm > sb.torqueNm ? [sa, sb] : [sb, sa];
    phrases.push(`The ${torquier.make} ${torquier.model} delivers more torque: ${ts2.torqueNm} Nm vs ${ls3.torqueNm} Nm.`);
  }

  if (phrases.length < 5) {
    throw new Error(
      `generatePhrases: only ${phrases.length} phrases generated for ${a.slug} vs ${b.slug}. Need at least 5. Check that both cars have sufficient spec data in D1.`
    );
  }
  return phrases;
}
