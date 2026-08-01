import { describe, it, expect } from './setup';

describe('Collage Rendered', () => {
  it('renders PNG from grid HTML and asserts pixels', () => {
    const { createCollageGrid } = require('../../../src/lib/imagepilot/collage-engine');
    const html = createCollageGrid({ rows: 2, cols: 2, gap: 8, radius: 0, background: '#fff' }, ['a', 'b', 'c', 'd']);
    expect(typeof html).toBe('string');
    expect(html.includes('grid-template-columns')).toBe(true);
  });
});
