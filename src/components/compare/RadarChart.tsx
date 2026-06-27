import {
  Chart as ChartJS,
  RadialLinearScale,
  PointElement,
  LineElement,
  Filler,
  Tooltip,
  Legend,
} from 'chart.js';
import { Radar } from 'react-chartjs-2';
import type { RadarData } from '../../lib/compare-score.js';

ChartJS.register(RadialLinearScale, PointElement, LineElement, Filler, Tooltip, Legend);

interface Props {
  labelA: string;
  labelB: string;
  dataA: RadarData;
  dataB: RadarData;
}

const LABELS = ['Power', 'Efficiency', 'Practicality', 'Performance', 'Comfort', 'Value'];

export default function RadarChart({ labelA, labelB, dataA, dataB }: Props) {
  const toArray = (d: RadarData) => [
    d.power, d.efficiency, d.practicality, d.performance, d.comfort, d.value,
  ];

  const data = {
    labels: LABELS,
    datasets: [
      {
        label: labelA,
        data: toArray(dataA),
        backgroundColor: 'rgba(247, 215, 32, 0.2)',
        borderColor: '#F7D720',
        borderWidth: 2,
        pointBackgroundColor: '#F7D720',
      },
      {
        label: labelB,
        data: toArray(dataB),
        backgroundColor: 'rgba(255, 80, 80, 0.2)',
        borderColor: '#ff5050',
        borderWidth: 2,
        pointBackgroundColor: '#ff5050',
      },
    ],
  };

  const options = {
    responsive: true,
    scales: {
      r: {
        min: 0,
        max: 100,
        ticks: { display: false },
        grid: { color: '#222' },
        pointLabels: { color: '#aaa', font: { size: 12 } },
        angleLines: { color: '#222' },
      },
    },
    plugins: {
      legend: { labels: { color: '#ccc' } },
    },
  };

  return (
    <section style={{ margin: '3rem 0' }}>
      <h2 style={{ fontWeight: 800, fontSize: '1.4rem', marginBottom: '1rem' }}>
        Radar Comparison
      </h2>
      <div style={{ maxWidth: 500, margin: '0 auto' }}>
        <Radar data={data} options={options} />
      </div>
    </section>
  );
}
