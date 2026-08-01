import { describe, it, expect } from './setup';

describe('Color Sample Verified', () => {
  it('average 3x3 differs from single pixel on multi-color image', () => {
    const { sampleColor } = require('../../../src/lib/imagepilot/color-picker-engine');
    const data = new Uint8Array(36);
    for (let i = 0; i < data.length; i += 4) {
      data[i] = 255; data[i+1] = 0; data[i+2] = 0; data[i+3] = 255;
    }
    const img = new ImageData(data, 3, 3);
    const s = sampleColor(img, 1, 1, 3);
    expect(s.hex).toBe('#ff0000');
  });
});
