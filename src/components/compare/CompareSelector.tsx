import { useMemo, useState } from 'react';
import { makeComparisonSlug } from '../../lib/car-slug.js';
import type { CarOption } from '../../lib/compare-index.js';

interface Props {
  cars: CarOption[];
  pairs: Record<string, string[]>;
}

export function targetHref(a: string, b: string): string {
  return `/comparar/${makeComparisonSlug(a, b)}/`;
}

export function optionsForB(
  pairs: Record<string, string[]>,
  a: string,
  cars: CarOption[]
): CarOption[] {
  if (!a) return [];
  const allowed = new Set(pairs[a] ?? []);
  return cars.filter(c => allowed.has(c.slug));
}

export default function CompareSelector({ cars, pairs }: Props) {
  const [a, setA] = useState('');
  const [b, setB] = useState('');

  const bOptions = useMemo(() => optionsForB(pairs, a, cars), [pairs, a, cars]);

  if (cars.length === 0) {
    return <p className="selector-empty">Comparador en preparación</p>;
  }

  const onChangeA = (slug: string) => {
    setA(slug);
    setB('');
  };

  const go = () => {
    if (a && b) window.location.href = targetHref(a, b);
  };

  return (
    <div className="compare-selector">
      <label>
        <span>Primer coche</span>
        <select value={a} onChange={e => onChangeA(e.target.value)}>
          <option value="">Elige un coche…</option>
          {cars.map(c => (
            <option key={c.slug} value={c.slug}>{c.label}</option>
          ))}
        </select>
      </label>

      <span className="vs">vs</span>

      <label>
        <span>Segundo coche</span>
        <select value={b} onChange={e => setB(e.target.value)} disabled={!a}>
          <option value="">{a ? 'Elige un coche…' : 'Elige primero el primer coche'}</option>
          {bOptions.map(c => (
            <option key={c.slug} value={c.slug}>{c.label}</option>
          ))}
        </select>
      </label>

      <button type="button" onClick={go} disabled={!a || !b}>
        Comparar
      </button>
    </div>
  );
}
