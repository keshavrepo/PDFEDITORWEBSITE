import { describe, it, expect } from './setup';

describe('ICO Byte Verified', () => {
  it('header has icon type 1 and 6 entries', () => {
    const { encodeIco } = require('../../../src/lib/imagepilot/ico-encoder');
    const png = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
    const ico = encodeIco([
      { size: 16, pngData: png }, { size: 32, pngData: png },
      { size: 48, pngData: png }, { size: 64, pngData: png },
      { size: 128, pngData: png }, { size: 256, pngData: png }
    ]);
    expect(ico[2]).toBe(1);
    expect(ico[4]).toBe(6);
  });
});
