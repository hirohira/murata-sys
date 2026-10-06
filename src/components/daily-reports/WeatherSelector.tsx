'use client';

import { WEATHERS } from '@/lib/constants';
import type { Weather } from '@/types';

interface Props {
  value: Weather;
  onChange: (weather: Weather) => void;
}

export default function WeatherSelector({ value, onChange }: Props) {
  return (
    <div className="flex gap-2">
      {WEATHERS.map((w) => (
        <button
          key={w.value}
          type="button"
          onClick={() => onChange(w.value)}
          className={`flex-1 flex flex-col items-center gap-1 py-3 rounded-xl border-2 transition-all ${
            value === w.value
              ? 'border-murata-primary bg-murata-primary-light'
              : 'border-gray-200 bg-white hover:border-gray-300'
          }`}
        >
          <span className="text-2xl">{w.emoji}</span>
          <span
            className={`text-xs font-medium ${
              value === w.value ? 'text-murata-primary' : 'text-gray-500'
            }`}
          >
            {w.label}
          </span>
        </button>
      ))}
    </div>
  );
}
