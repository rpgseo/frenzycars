import type { CarSpecs } from '../../lib/d1-client.js';

interface Props {
  specsA: CarSpecs;
  specsB: CarSpecs;
  labelA: string;
  labelB: string;
}

interface BarDef {
  label: string;
  valueA: number | null;
  valueB: number | null;
  unit: string;
  lowerIsBetter?: boolean;
}

export default function StatBars({ specsA, specsB, labelA, labelB }: Props) {
  const bars: BarDef[] = [
    { label: 'Horsepower', valueA: specsA.powerHp, valueB: specsB.powerHp, unit: 'hp' },
    { label: '0–100 km/h', valueA: specsA.acceleration0100, valueB: specsB.acceleration0100, unit: 's', lowerIsBetter: true },
    { label: 'Top Speed', valueA: specsA.topSpeedKmh, valueB: specsB.topSpeedKmh, unit: 'km/h' },
    { label: 'Weight', valueA: specsA.weightKg, valueB: specsB.weightKg, unit: 'kg', lowerIsBetter: true },
    { label: 'Trunk Volume', valueA: specsA.trunkLiters, valueB: specsB.trunkLiters, unit: 'L' },
  ].filter(b => b.valueA != null || b.valueB != null);

  return (
    <section style={{ margin: '3rem 0' }}>
      <h2 style={{ fontWeight: 800, fontSize: '1.4rem', marginBottom: '1.5rem' }}>
        Performance at a Glance
      </h2>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
        {bars.map(bar => {
          const va = bar.valueA ?? 0;
          const vb = bar.valueB ?? 0;
          const max = Math.max(va, vb) || 1;
          const pctA = Math.round((va / max) * 100);
          const pctB = Math.round((vb / max) * 100);
          const aWins = bar.lowerIsBetter ? va < vb : va > vb;
          const bWins = bar.lowerIsBetter ? vb < va : vb > va;

          return (
            <div key={bar.label}>
              <div style={{ fontSize: '0.85rem', color: '#888', marginBottom: '0.5rem' }}>
                {bar.label}
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                  <span style={{ width: 120, fontSize: '0.8rem', color: '#ccc', textAlign: 'right', flexShrink: 0 }}>
                    {labelA}
                  </span>
                  <div style={{ flex: 1, background: '#1a1a1a', borderRadius: 4, height: 12, overflow: 'hidden' }}>
                    <div style={{
                      width: `${pctA}%`, height: '100%',
                      background: aWins ? '#F7D720' : '#555',
                      borderRadius: 4,
                      transition: 'width 0.8s ease',
                    }} />
                  </div>
                  <span style={{ fontSize: '0.85rem', color: aWins ? '#F7D720' : '#ccc', minWidth: 60 }}>
                    {bar.valueA != null ? `${bar.valueA} ${bar.unit}` : '—'}
                  </span>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                  <span style={{ width: 120, fontSize: '0.8rem', color: '#ccc', textAlign: 'right', flexShrink: 0 }}>
                    {labelB}
                  </span>
                  <div style={{ flex: 1, background: '#1a1a1a', borderRadius: 4, height: 12, overflow: 'hidden' }}>
                    <div style={{
                      width: `${pctB}%`, height: '100%',
                      background: bWins ? '#ff5050' : '#555',
                      borderRadius: 4,
                      transition: 'width 0.8s ease',
                    }} />
                  </div>
                  <span style={{ fontSize: '0.85rem', color: bWins ? '#ff5050' : '#ccc', minWidth: 60 }}>
                    {bar.valueB != null ? `${bar.valueB} ${bar.unit}` : '—'}
                  </span>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}
