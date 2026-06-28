import { useMemo, useState } from 'react';
import { makeComparisonSlug } from '../../lib/car-slug.js';
import type { CarMeta, CarOption } from '../../lib/compare-index.js';

interface Props {
  cars: CarOption[];
  pairs: Record<string, string[]>;
  metas: CarMeta[];
}

// --- Pure helpers (exported for tests) ---

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

export function uniqueSorted(values: string[]): string[] {
  return [...new Set(values)].sort();
}

// --- Cascaded picker for one car slot ---

interface CarPickerProps {
  label: string;
  metas: CarMeta[];
  allowedSlugs: Set<string> | null; // null = unrestricted (car A)
  value: string;
  onChange: (slug: string) => void;
  disabled?: boolean;
}

function CarPicker({ label, metas, allowedSlugs, value, onChange, disabled }: CarPickerProps) {
  const pool = allowedSlugs
    ? metas.filter(m => allowedSlugs.has(m.slug))
    : metas;

  const makes = uniqueSorted(pool.map(m => m.make));

  const selectedMeta = pool.find(m => m.slug === value) ?? null;
  const [make, setMake] = useState(selectedMeta?.make ?? '');
  const [model, setModel] = useState(selectedMeta?.model ?? '');
  const [year, setYear] = useState(selectedMeta?.year ? String(selectedMeta.year) : '');

  const modelsForMake = useMemo(
    () => uniqueSorted(pool.filter(m => m.make === make).map(m => m.model)),
    [pool, make]
  );

  const yearsForMakeModel = useMemo(
    () =>
      uniqueSorted(
        pool
          .filter(m => m.make === make && m.model === model && m.year != null)
          .map(m => String(m.year))
      ).reverse(),
    [pool, make, model]
  );

  const trimsForSelection = useMemo(
    () =>
      pool.filter(
        m => m.make === make && m.model === model && String(m.year ?? '') === year
      ),
    [pool, make, model, year]
  );

  const onChangeMake = (v: string) => {
    setMake(v);
    setModel('');
    setYear('');
    onChange('');
  };
  const onChangeModel = (v: string) => {
    setModel(v);
    setYear('');
    onChange('');
  };
  const onChangeYear = (v: string) => {
    setYear(v);
    // auto-select if only one trim
    const candidates = pool.filter(
      m => m.make === make && m.model === model && String(m.year ?? '') === v
    );
    onChange(candidates.length === 1 ? candidates[0].slug : '');
  };
  const onChangeTrim = (v: string) => onChange(v);

  return (
    <div className="car-picker">
      <span className="picker-label">{label}</span>

      <select value={make} onChange={e => onChangeMake(e.target.value)} disabled={disabled || pool.length === 0}>
        <option value="">Make…</option>
        {makes.map(mk => <option key={mk} value={mk}>{mk}</option>)}
      </select>

      <select value={model} onChange={e => onChangeModel(e.target.value)} disabled={!make}>
        <option value="">Model…</option>
        {modelsForMake.map(md => <option key={md} value={md}>{md}</option>)}
      </select>

      <select value={year} onChange={e => onChangeYear(e.target.value)} disabled={!model}>
        <option value="">Year…</option>
        {yearsForMakeModel.map(y => <option key={y} value={y}>{y}</option>)}
      </select>

      {trimsForSelection.length > 1 && (
        <select value={value} onChange={e => onChangeTrim(e.target.value)} disabled={!year}>
          <option value="">Trim…</option>
          {trimsForSelection.map(m => (
            <option key={m.slug} value={m.slug}>{m.trim}</option>
          ))}
        </select>
      )}
    </div>
  );
}

// --- Main island ---

export default function CompareSelector({ cars, pairs, metas }: Props) {
  const [slugA, setSlugA] = useState('');
  const [slugB, setSlugB] = useState('');

  if (metas.length === 0) {
    return <p className="selector-empty">Comparador en preparación</p>;
  }

  const allowedForB: Set<string> | null = slugA
    ? new Set(pairs[slugA] ?? [])
    : new Set(); // empty set until A is chosen — no options shown

  const canCompare = slugA && slugB;

  const go = () => {
    if (canCompare) window.location.href = targetHref(slugA, slugB);
  };

  return (
    <div className="compare-selector">
      <CarPicker
        label="Car A"
        metas={metas}
        allowedSlugs={null}
        value={slugA}
        onChange={v => { setSlugA(v); setSlugB(''); }}
      />

      <span className="vs">vs</span>

      <CarPicker
        label="Car B"
        metas={metas}
        allowedSlugs={allowedForB}
        value={slugB}
        onChange={setSlugB}
        disabled={!slugA}
      />

      <button type="button" onClick={go} disabled={!canCompare}>
        Compare
      </button>
    </div>
  );
}
