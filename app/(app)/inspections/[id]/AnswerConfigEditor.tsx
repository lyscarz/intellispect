'use client';

import { nanoid } from 'nanoid';
import type { AnswerConfig, AnswerType } from '@/lib/inspections/types';

const TYPES: { value: AnswerType; label: string }[] = [
  { value: 'yes_no', label: 'Yes / No' },
  { value: 'yes_no_na', label: 'Yes / No / N/A' },
  { value: 'measurement', label: 'Measurement (number + unit)' },
  { value: 'free_text', label: 'Free text' },
  { value: 'photo_set', label: 'Photo set' },
];

export function AnswerConfigEditor({
  value,
  onChange,
}: {
  value: AnswerConfig;
  onChange: (v: AnswerConfig) => void;
}) {
  function switchType(type: AnswerType) {
    if (type === value.type) return;
    switch (type) {
      case 'yes_no':
        return onChange({ type: 'yes_no', correct: 'yes' });
      case 'yes_no_na':
        return onChange({ type: 'yes_no_na', correct: 'yes' });
      case 'measurement':
        return onChange({ type: 'measurement', units: ['bar'], defaultUnit: 'bar' });
      case 'free_text':
        return onChange({ type: 'free_text' });
      case 'photo_set':
        return onChange({
          type: 'photo_set',
          slots: [{ id: nanoid(6), label: 'Front' }],
        });
    }
  }

  return (
    <div className="mt-3 rounded-md bg-slate-50 border border-slate-200 p-2">
      <div className="flex items-center gap-2">
        <span className="text-xs font-medium text-slate-600">Answer:</span>
        <select
          value={value.type}
          onChange={(e) => switchType(e.target.value as AnswerType)}
          className="text-xs px-2 py-1 rounded border border-slate-300 bg-white"
        >
          {TYPES.map((t) => (
            <option key={t.value} value={t.value}>
              {t.label}
            </option>
          ))}
        </select>
      </div>

      {value.type === 'yes_no' && (
        <CorrectPicker
          options={['yes', 'no']}
          value={value.correct}
          onChange={(correct) => onChange({ type: 'yes_no', correct: correct as 'yes' | 'no' })}
        />
      )}
      {value.type === 'yes_no_na' && (
        <CorrectPicker
          options={['yes', 'no', 'na']}
          value={value.correct}
          onChange={(correct) =>
            onChange({ type: 'yes_no_na', correct: correct as 'yes' | 'no' | 'na' })
          }
        />
      )}
      {value.type === 'measurement' && (
        <MeasurementEditor value={value} onChange={onChange} />
      )}
      {value.type === 'photo_set' && (
        <PhotoSlotsEditor value={value} onChange={onChange} />
      )}
    </div>
  );
}

function CorrectPicker({
  options,
  value,
  onChange,
}: {
  options: string[];
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <div className="mt-2 flex items-center gap-2 text-xs">
      <span className="text-slate-500">Correct answer:</span>
      {options.map((o) => (
        <button
          key={o}
          type="button"
          onClick={() => onChange(o)}
          className={`px-2 py-0.5 rounded uppercase tracking-wide font-semibold ${
            value === o
              ? 'bg-emerald-100 text-emerald-700 ring-1 ring-emerald-300'
              : 'bg-white text-slate-500 border border-slate-200'
          }`}
        >
          {o.replace('_', ' ')}
        </button>
      ))}
    </div>
  );
}

function MeasurementEditor({
  value,
  onChange,
}: {
  value: Extract<AnswerConfig, { type: 'measurement' }>;
  onChange: (v: AnswerConfig) => void;
}) {
  function setUnitsText(text: string) {
    const units = text
      .split(',')
      .map((u) => u.trim())
      .filter(Boolean);
    onChange({ ...value, units, defaultUnit: units.includes(value.defaultUnit ?? '') ? value.defaultUnit : units[0] });
  }
  return (
    <div className="mt-2 grid sm:grid-cols-3 gap-2 text-xs">
      <label className="block sm:col-span-2">
        <span className="text-slate-500">Units (comma-separated)</span>
        <input
          type="text"
          value={value.units.join(', ')}
          onChange={(e) => setUnitsText(e.target.value)}
          placeholder="bar, PSI, kPa"
          className="mt-1 w-full px-2 py-1 rounded border border-slate-300 bg-white"
        />
      </label>
      <label className="block">
        <span className="text-slate-500">Default</span>
        <select
          value={value.defaultUnit ?? value.units[0] ?? ''}
          onChange={(e) => onChange({ ...value, defaultUnit: e.target.value })}
          className="mt-1 w-full px-2 py-1 rounded border border-slate-300 bg-white"
        >
          {value.units.map((u) => (
            <option key={u} value={u}>
              {u}
            </option>
          ))}
        </select>
      </label>
      <label className="block">
        <span className="text-slate-500">Min (optional)</span>
        <input
          type="number"
          value={value.min ?? ''}
          onChange={(e) =>
            onChange({ ...value, min: e.target.value === '' ? undefined : Number(e.target.value) })
          }
          className="mt-1 w-full px-2 py-1 rounded border border-slate-300 bg-white"
        />
      </label>
      <label className="block">
        <span className="text-slate-500">Max (optional)</span>
        <input
          type="number"
          value={value.max ?? ''}
          onChange={(e) =>
            onChange({ ...value, max: e.target.value === '' ? undefined : Number(e.target.value) })
          }
          className="mt-1 w-full px-2 py-1 rounded border border-slate-300 bg-white"
        />
      </label>
    </div>
  );
}

function PhotoSlotsEditor({
  value,
  onChange,
}: {
  value: Extract<AnswerConfig, { type: 'photo_set' }>;
  onChange: (v: AnswerConfig) => void;
}) {
  function update(i: number, label: string) {
    onChange({
      ...value,
      slots: value.slots.map((s, idx) => (idx === i ? { ...s, label } : s)),
    });
  }
  function remove(i: number) {
    onChange({ ...value, slots: value.slots.filter((_, idx) => idx !== i) });
  }
  function add() {
    if (value.slots.length >= 8) return;
    onChange({ ...value, slots: [...value.slots, { id: nanoid(6), label: 'New slot' }] });
  }
  return (
    <div className="mt-2 text-xs">
      <div className="text-slate-500 mb-1">Photo slots ({value.slots.length}/8)</div>
      <div className="grid sm:grid-cols-2 gap-1.5">
        {value.slots.map((s, i) => (
          <div key={s.id} className="flex items-center gap-1.5">
            <input
              type="text"
              value={s.label}
              onChange={(e) => update(i, e.target.value)}
              className="flex-1 px-2 py-1 rounded border border-slate-300 bg-white"
              placeholder="e.g. Front left"
            />
            <button
              type="button"
              onClick={() => remove(i)}
              className="text-rose-500 hover:text-rose-700 text-xs"
            >
              ✕
            </button>
          </div>
        ))}
      </div>
      <button
        type="button"
        onClick={add}
        disabled={value.slots.length >= 8}
        className="mt-1.5 text-brand-700 hover:text-brand-800 font-medium disabled:opacity-40"
      >
        + Add slot
      </button>
    </div>
  );
}
