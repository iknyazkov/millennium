import { describe, expect, it } from 'vitest';
import { buildLut, composeLuts, buildChannelLuts } from './curve';

describe('buildLut (XMP control points → 256-entry LUT)', () => {
  it('identity curve maps x to x', () => {
    const lut = buildLut([
      [0, 0],
      [255, 255],
    ]);
    expect(lut[0]).toBe(0);
    expect(lut[128]).toBe(128);
    expect(lut[255]).toBe(255);
  });

  it('hits every control point exactly (Portra composite)', () => {
    const lut = buildLut([
      [0, 34],
      [68, 62],
      [255, 245],
    ]);
    expect(lut[0]).toBe(34); // lifted blacks
    expect(lut[68]).toBe(62);
    expect(lut[255]).toBe(245); // compressed whites
    expect(lut[10]).toBeGreaterThan(34); // monotone rise between points
    expect(lut[10]).toBeLessThan(62);
  });

  it('interpolates linearly between points', () => {
    const lut = buildLut([
      [0, 0],
      [100, 50],
      [255, 255],
    ]);
    expect(lut[50]).toBe(25);
    expect(lut[200]).toBe(Math.round(50 + (100 / 155) * 205));
  });
});

describe('composeLuts (LR order: composite first, then per-channel)', () => {
  it('channel applied to composite output', () => {
    const composite = buildLut([
      [0, 34],
      [255, 100],
    ]);
    const channel = buildLut([
      [0, 0],
      [100, 200],
      [255, 255],
    ]);
    const composed = composeLuts(composite, channel);
    expect(composed[0]).toBe(channel[34]);
    expect(composed[255]).toBe(channel[100]);
  });
});

describe('buildChannelLuts', () => {
  it('channels without own curve reuse the composite LUT', () => {
    const { r, g, b } = buildChannelLuts({
      points: [
        [0, 20],
        [255, 250],
      ],
    });
    expect(r).toBe(g);
    expect(g).toBe(b);
    expect(r[0]).toBe(20);
  });

  it('Ektar-style per-channel curves differ from each other', () => {
    const { r, g, b } = buildChannelLuts({
      points: [
        [0, 24],
        [82, 90],
        [255, 253],
      ],
      r: [
        [0, 0],
        [44, 11],
        [70, 38],
        [96, 88],
        [147, 179],
        [191, 223],
        [255, 255],
      ],
      g: [
        [0, 0],
        [28, 7],
        [61, 35],
        [92, 82],
        [149, 181],
        [189, 221],
        [255, 255],
      ],
      b: [
        [0, 0],
        [24, 10],
        [93, 82],
        [148, 177],
        [198, 226],
        [255, 255],
      ],
    });
    expect(r).not.toEqual(g);
    expect(g).not.toEqual(b);
    // every entry is a valid byte
    expect(r.every((v) => v >= 0 && v <= 255)).toBe(true);
  });
});
