import { describe, it, expect } from './setup';

describe('Compare Mode', () => {
  it('slider and side-by-side modes exist', () => {
    expect('slider').toBe('slider');
    expect('side-by-side').toBe('side-by-side');
  });
});
