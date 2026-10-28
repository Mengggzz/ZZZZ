export type FilterPreset = 'original' | 'bw' | 'sepia' | 'vintage';

export interface FilterOption {
  id: FilterPreset;
  label: string;
}

export const FILTER_PRESETS: FilterOption[] = [
  { id: 'original', label: 'Asli' },
  { id: 'bw', label: 'Hitam Putih' },
  { id: 'sepia', label: 'Sepia' },
  { id: 'vintage', label: 'Vintage' },
];

export function getFilterStyle(filter: FilterPreset): string {
  switch (filter) {
    case 'bw':
      return 'grayscale(100%) contrast(110%)';
    case 'sepia':
      return 'sepia(100%) contrast(95%) brightness(95%)';
    case 'vintage':
      return 'sepia(30%) contrast(120%) brightness(105%) saturate(120%)';
    case 'original':
    default:
      return 'none';
  }
}
