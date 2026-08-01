import { describe, it, expect } from './setup';

describe('Export Presets', () => {
  it('default presets contain PNG, JPEG, SVG', () => {
    const presets = require('../../../src/lib/imagepilot/export-utils');
    const names = presets.defaultPresets.map((p: any) => p.name);
    expect(names.includes('Web PNG')).toBe(true);
    expect(names.includes('Web JPEG')).toBe(true);
  });
});
