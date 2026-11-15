import { describe, expect, it } from 'vitest';
import { gradeToMatrix } from './grade';

describe('gradeToMatrix (pure color math, 5x4 rows for WebGLImageFilter.colorMatrix)', () => {
  it('neutral grade is identity', () => {
    const m = gradeToMatrix({ temp: 0, tint: 0, lift: 0, fade: 0 });
    expect(m.slice(0, 5)).toEqual([1, 0, 0, 0, 0]);
    expect(m.slice(15, 20)).toEqual([0, 0, 0, 1, 0]);
  });

  it('warm temp raises red, lowers blue', () => {
    const m = gradeToMatrix({ temp: 0.5, tint: 0, lift: 0, fade: 0 });
    expect(m[0]).toBeGreaterThan(1); // R gain up
    expect(m[12]).toBeLessThan(1); // B gain down
  });

  it('lift raises blacks', () => {
    const m = gradeToMatrix({ temp: 0, tint: 0, lift: 0.3, fade: 0 });
    // pure black (0,0,0) must map above zero
    const [r, g, b] = apply(m, [0, 0, 0]);
    expect(r).toBeGreaterThan(0);
    expect(g).toBeGreaterThan(0);
    expect(b).toBeGreaterThan(0);
  });

  it('lift is warm-biased (R offset > B offset) — the Garcia warm-shadows recipe', () => {
    const m = gradeToMatrix({ temp: 0, tint: 0, lift: 0.3, fade: 0 });
    expect(m[4]).toBeGreaterThan(m[14]); // offset R > offset B
  });

  it('fade compresses whites down (soft rolloff)', () => {
    const m = gradeToMatrix({ temp: 0, tint: 0, lift: 0, fade: 0.5 });
    const [r] = apply(m, [1, 1, 1]);
    expect(r).toBeLessThan(1);
    expect(r).toBeGreaterThan(0.5); // ...but not crushed
  });

  it('tint shifts green vs magenta in opposite directions', () => {
    const up = gradeToMatrix({ temp: 0, tint: 0.5, lift: 0, fade: 0 });
    const down = gradeToMatrix({ temp: 0, tint: -0.5, lift: 0, fade: 0 });
    expect(up[6]).toBeGreaterThan(down[6]); // G gain
  });
});

function apply(m: number[], [r, g, b]: [number, number, number]): [number, number, number] {
  // m is 20 entries: 4 rows x (r,g,b,a,offset); offsets here already 0-255 style
  // (engine divides them by 255) — keep this helper in the same convention as input
  return [
    m[0] * r + m[1] * g + m[2] * b + m[4],
    m[5] * r + m[6] * g + m[7] * b + m[9],
    m[10] * r + m[11] * g + m[12] * b + m[14],
  ];
}
