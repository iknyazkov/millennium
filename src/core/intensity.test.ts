import { describe, expect, it } from 'vitest';
import { applyIntensity } from './intensity';
import type { Op } from './preset';

describe('applyIntensity', () => {
  it('t = 0 kills the whole list — untouched photo', () => {
    const ops: Op[] = [
      { type: 'grade', temp: 0.5, tint: 0.1, lift: 0.2, fade: 0.3 },
      { type: 'blur', radius: 2 },
      { type: 'downscale', width: 640 },
    ];
    expect(applyIntensity(ops, 0)).toEqual([]);
  });

  it('t = 1 returns the ops as authored', () => {
    const ops: Op[] = [{ type: 'saturation', amount: -0.25 }, { type: 'vignette', amount: 0.5 }];
    expect(applyIntensity(ops, 1)).toEqual(ops);
  });

  it('scales amount ops toward neutral 0', () => {
    expect(applyIntensity([{ type: 'brightness', amount: 0.3 }], 0.5)).toEqual([
      { type: 'brightness', amount: 0.15 },
    ]);
    // Past authored: 2× the strength
    expect(applyIntensity([{ type: 'contrast', amount: 0.4 }], 2)).toEqual([
      { type: 'contrast', amount: 0.8 },
    ]);
  });

  it('scales grade params toward neutral 0 and clamps to schema bounds', () => {
    expect(applyIntensity([{ type: 'grade', temp: 0.5, tint: 0.1, lift: 0.4, fade: 0.3 }], 0.5)).toEqual([
      { type: 'grade', temp: 0.25, tint: 0.05, lift: 0.2, fade: 0.15 },
    ]);
    expect(applyIntensity([{ type: 'grade', temp: 0.9, tint: 0, lift: 0.8, fade: 0 }], 2)).toEqual([
      { type: 'grade', temp: 1, tint: 0, lift: 1, fade: 0 },
    ]);
  });

  it('converts a scaled film to a blended colorMatrix: t=0.5 is the identity/sepia average', () => {
    const [op] = applyIntensity([{ type: 'film', film: 'sepia' }], 0.5);
    expect(op.type).toBe('colorMatrix');
    if (op.type !== 'colorMatrix') return;
    const sepia = [0.393, 0.7689999, 0.18899999, 0, 0, 0.349, 0.6859999, 0.16799999, 0, 0, 0.272, 0.5339999, 0.13099999, 0, 0, 0, 0, 0, 1, 0];
    const identity = [1, 0, 0, 0, 0, 0, 1, 0, 0, 0, 0, 0, 1, 0, 0, 0, 0, 0, 1, 0];
    op.matrix.forEach((v, i) => expect(v).toBeCloseTo((identity[i] + sepia[i]) / 2, 5));
  });

  it('pulls curve output toward its own input', () => {
    const [op] = applyIntensity([{ type: 'curve', points: [[0, 34], [68, 62], [255, 245]] }], 0.5);
    if (op.type !== 'curve') throw new Error('expected curve');
    expect(op.points).toEqual([[0, 17], [68, 65], [255, 250]]);
    // t = 0 would be full identity [[0,0],[68,68],[255,255]] — but t=0 returns []
  });

  it('clamps 0..1 amounts and blur at their schema bounds', () => {
    expect(applyIntensity([{ type: 'vignette', amount: 0.5 }], 2)).toEqual([
      { type: 'vignette', amount: 1 },
    ]);
    expect(applyIntensity([{ type: 'blur', radius: 6 }], 2)).toEqual([{ type: 'blur', radius: 10 }]);
    expect(applyIntensity([{ type: 'ca', amount: 0.5 }], 2)).toEqual([{ type: 'ca', amount: 1 }]);
  });

  it('noise amount scales; shadow scale pivots on 0.5', () => {
    expect(applyIntensity([{ type: 'noise', amount: 0.4, shadow: 0.7 }], 0.5)).toEqual([
      { type: 'noise', amount: 0.2, shadow: 0.6 },
    ]);
  });

  it('jpeg: neutral is lossless 1, artifacts grow with t', () => {
    expect(applyIntensity([{ type: 'jpeg', quality: 0.25 }], 0.5)).toEqual([
      { type: 'jpeg', quality: 0.625 },
    ]);
    expect(applyIntensity([{ type: 'jpeg', quality: 0.25 }], 2)).toEqual([
      { type: 'jpeg', quality: 0.05 },
    ]);
  });

  it('downscale survives scaling unchanged (structural, not a strength)', () => {
    expect(applyIntensity([{ type: 'downscale', width: 640 }], 0.5)).toEqual([
      { type: 'downscale', width: 640 },
    ]);
  });

  it('clamps the slider value itself', () => {
    expect(applyIntensity([{ type: 'brightness', amount: 0.3 }], 99)).toEqual(
      applyIntensity([{ type: 'brightness', amount: 0.3 }], 2),
    );
    expect(applyIntensity([{ type: 'brightness', amount: 0.3 }], -5)).toEqual([]);
  });
});
