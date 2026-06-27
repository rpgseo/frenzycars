// Stub — full implementation in Task 6
import type { RadarData } from '../../lib/compare-score.js';

interface Props {
  labelA: string;
  labelB: string;
  dataA: RadarData;
  dataB: RadarData;
}

export default function RadarChart({ labelA, labelB, dataA, dataB }: Props) {
  return <div className="radar-chart" aria-label={`${labelA} vs ${labelB} radar chart`} />;
}
