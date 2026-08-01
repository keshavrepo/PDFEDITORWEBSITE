import { describe, it, expect } from './setup';

describe('SVG Optimizer Verified', () => {
  it('messy SVG with comments and metadata is cleaned', () => {
    const { optimizeSvg } = require('../../../src/lib/imagepilot/svg-utils');
    const messy = `<?xml version="1.0"?>\n<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink"><metadata>editor</metadata><!-- comment --><g fill="black"><rect x="0" y="0" width="100.12345" height="200.67890"/></g></svg>`;
    const result = optimizeSvg(messy);
    expect(result.deltaBytes).toBeGreaterThanOrEqual(0);
    const hasMeta = result.optimizedString.includes('metadata');
    if (hasMeta) throw new Error('Should not contain metadata');
    const hasComment = result.optimizedString.includes('<!--');
    if (hasComment) throw new Error('Should not contain comments');
    expect(result.optimizedString.includes('100.12') || result.optimizedString.includes('100.12')).toBe(true);
  });
});
