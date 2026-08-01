export function describe(name: string, fn: () => void) { console.log('DESCRIBE:', name); fn(); }
export function it(name: string, fn: () => void) { try { fn(); console.log('PASS:', name); } catch (e) { console.log('FAIL:', name, e); } }
export const expect = (v: any) => ({
  toBe: (expected: any) => { if (v !== expected) throw new Error(`Expected ${expected} but got ${v}`); },
  toBeGreaterThan: (expected: number) => { if (!(v > expected)) throw new Error(`Expected > ${expected} but got ${v}`); },
  toBeLessThanOrEqual: (expected: number) => { if (!(v <= expected)) throw new Error(`Expected <= ${expected} but got ${v}`); },
  not: { toContain: (s: string) => { if ((v as string).includes(s)) throw new Error(`Expected not to contain ${s}`); } },
  toContain: (s: string) => { if (!(v as string).includes(s)) throw new Error(`Expected to contain ${s}`); },
});
