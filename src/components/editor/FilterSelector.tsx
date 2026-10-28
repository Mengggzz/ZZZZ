'use client';
import React from 'react';
import { FILTER_PRESETS, FilterPreset } from '@/lib/filters';

export interface FilterSelectorProps {
  selected: FilterPreset;
  onSelect: (filter: FilterPreset) => void;
  disabled?: boolean;
  className?: string;
}

export function FilterSelector({
  selected,
  onSelect,
  disabled = false,
  className = '',
}: FilterSelectorProps) {
  return (
    <div
      role="group"
      aria-label="Filter Presets"
      className={`flex gap-2 p-2 overflow-x-auto justify-center ${className}`}
    >
      {FILTER_PRESETS.map((opt) => {
        const isSelected = selected === opt.id;
        return (
          <button
            key={opt.id}
            type="button"
            data-testid={`filter-option-${opt.id}`}
            aria-pressed={isSelected}
            disabled={disabled}
            onClick={() => onSelect(opt.id)}
            className={`px-4 py-2 rounded-full text-xs font-semibold transition ${
              isSelected
                ? 'bg-black text-white shadow-sm'
                : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
            } ${disabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}`}
          >
            {opt.label}
          </button>
        );
      })}
    </div>
  );
}
