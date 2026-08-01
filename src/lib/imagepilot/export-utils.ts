export interface ExportPreset {
  name: string;
  format: 'png' | 'jpeg' | 'svg';
  quality?: number;
  scale: number;
}

export const defaultPresets: ExportPreset[] = [
  { name: 'Web PNG', format: 'png', scale: 1 },
  { name: 'Web JPEG', format: 'jpeg', quality: 0.85, scale: 1 },
  { name: 'High Res', format: 'png', scale: 2 },
  { name: 'SVG Vector', format: 'svg', scale: 1 },
];
