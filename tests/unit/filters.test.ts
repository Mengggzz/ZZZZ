import { describe, it, expect } from 'vitest';
import { getFilterStyle, FILTER_PRESETS, type FilterPreset } from '../../src/lib/filters';

describe('Filter Styles', () => {
  it('returns valid CSS filter string for each preset', () => {
    expect(getFilterStyle('original')).toBe('none');
    expect(getFilterStyle('bw')).toContain('grayscale(100%)');
    expect(getFilterStyle('sepia')).toContain('sepia(100%)');
    expect(getFilterStyle('vintage')).toContain('contrast(120%)');
  });

  it('falls back to none for unknown filter', () => {
    expect(getFilterStyle('unknown' as FilterPreset)).toBe('none');
  });

  it('exports FILTER_PRESETS with id and label for each option', () => {
    expect(FILTER_PRESETS).toHaveLength(4);
    const ids = FILTER_PRESETS.map((p) => p.id);
    expect(ids).toEqual(['original', 'bw', 'sepia', 'vintage']);
  });
});
