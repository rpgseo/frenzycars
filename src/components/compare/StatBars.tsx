// Stub — full implementation in Task 6
import type { CarSpecs } from '../../lib/d1-client.js';

interface Props {
  specsA: CarSpecs;
  specsB: CarSpecs;
  labelA: string;
  labelB: string;
}

export default function StatBars({ specsA, specsB, labelA, labelB }: Props) {
  return <div className="stat-bars" aria-label={`${labelA} vs ${labelB} stat bars`} />;
}
