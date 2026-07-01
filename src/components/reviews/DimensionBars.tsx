interface Dimension {
  label: string;
  score: number;
}

interface Props {
  dimensions: Dimension[];
}

function colorForScore(score: number): string {
  if (score < 4) return '#ef4444';
  if (score < 7) return '#F7D720';
  return '#22c55e';
}

export default function DimensionBars({ dimensions }: Props) {
  if (!dimensions || dimensions.length === 0) return null;

  return (
    <section style={{ margin: '3rem 0' }}>
      <h2 style={{ fontWeight: 800, fontSize: '1.4rem', marginBottom: '1.5rem' }}>
        Performance Dimensions
      </h2>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '1.1rem' }}>
        {dimensions.map(dim => {
          const pct = Math.round((dim.score / 10) * 100);
          const color = colorForScore(dim.score);
          return (
            <div key={dim.label}>
              <div style={{
                display: 'flex', justifyContent: 'space-between',
                fontSize: '0.85rem', color: '#ccc', marginBottom: '0.4rem',
              }}>
                <span>{dim.label}</span>
                <span style={{ color, fontWeight: 700 }}>{dim.score.toFixed(1)}/10</span>
              </div>
              <div style={{ background: '#1a1a1a', borderRadius: 4, height: 10, overflow: 'hidden' }}>
                <div style={{
                  width: `${pct}%`, height: '100%',
                  background: color,
                  borderRadius: 4,
                  transition: 'width 0.8s ease',
                }} />
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}
