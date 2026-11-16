import { describe, expect, it } from 'vitest';
import { parsePreset, serializePreset, newPresetId } from './preset';

describe('parsePreset (boundary: outside JSON becomes typed or rejected)', () => {
  it('accepts a valid v1 preset and returns it typed', () => {
    const raw = {
      id: 'abc',
      name: 'Тёплая плёнка',
      version: 1,
      ops: [
        { type: 'film', film: 'kodachrome' },
        { type: 'saturation', amount: 0.2 },
      ],
    };
    const preset = parsePreset(raw);
    expect(preset).not.toBeNull();
    expect(preset?.ops).toHaveLength(2);
    expect(preset?.ops[1]).toEqual({ type: 'saturation', amount: 0.2 });
  });

  it('accepts an empty op list (a preset that does nothing)', () => {
    const preset = parsePreset({ id: 'a', name: 'Пустышка', version: 1, ops: [] });
    expect(preset?.ops).toEqual([]);
  });

  it('rejects a wrong schema version', () => {
    expect(parsePreset({ id: 'a', name: 'x', version: 2, ops: [] })).toBeNull();
  });

  it('rejects an unknown op type', () => {
    const raw = { id: 'a', name: 'x', version: 1, ops: [{ type: 'quantumDenoise', amount: 1 }] };
    expect(parsePreset(raw)).toBeNull();
  });

  it('rejects an op with an amount out of [-1, 1]', () => {
    const raw = { id: 'a', name: 'x', version: 1, ops: [{ type: 'brightness', amount: 1.5 }] };
    expect(parsePreset(raw)).toBeNull();
  });

  it('rejects an unknown film name', () => {
    const raw = { id: 'a', name: 'x', version: 1, ops: [{ type: 'film', film: 'fujisuperia' }] };
    expect(parsePreset(raw)).toBeNull();
  });

  it('rejects garbage that is not even an object', () => {
    expect(parsePreset('kodachrome')).toBeNull();
    expect(parsePreset(null)).toBeNull();
  });

  it('accepts a grade op with full params and clamps-free defaults', () => {
    const full = parsePreset({
      id: 'a', name: 'x', version: 1,
      ops: [{ type: 'grade', temp: 0.35, tint: -0.05, lift: 0.25, fade: 0.15 }],
    });
    expect(full?.ops[0]).toEqual({ type: 'grade', temp: 0.35, tint: -0.05, lift: 0.25, fade: 0.15 });

    const partial = parsePreset({
      id: 'a', name: 'x', version: 1,
      ops: [{ type: 'grade', temp: 0.4 }],
    });
    expect(partial?.ops[0]).toEqual({ type: 'grade', temp: 0.4, tint: 0, lift: 0, fade: 0 });
  });

  it('rejects a grade op with out-of-range temp', () => {
    expect(parsePreset({ id: 'a', name: 'x', version: 1, ops: [{ type: 'grade', temp: 2 }] })).toBeNull();
  });

  it('accepts blur within 0..10, rejects beyond', () => {
    expect(parsePreset({ id: 'a', name: 'x', version: 1, ops: [{ type: 'blur', radius: 2.5 }] })).not.toBeNull();
    expect(parsePreset({ id: 'a', name: 'x', version: 1, ops: [{ type: 'blur', radius: 11 }] })).toBeNull();
  });

  it('accepts vignette 0..1, rejects beyond', () => {
    expect(parsePreset({ id: 'a', name: 'x', version: 1, ops: [{ type: 'vignette', amount: 0.4 }] })).not.toBeNull();
    expect(parsePreset({ id: 'a', name: 'x', version: 1, ops: [{ type: 'vignette', amount: 1.4 }] })).toBeNull();
  });

  it('accepts the vga stack ops and validates their ranges', () => {
    const preset = parsePreset({
      id: 'a', name: 'x', version: 1,
      ops: [
        { type: 'downscale', width: 640 },
        { type: 'noise', amount: 0.4, shadow: 0.7 },
        { type: 'jpeg', quality: 0.25 },
      ],
    });
    expect(preset?.ops).toHaveLength(3);

    expect(parsePreset({ id: 'a', name: 'x', version: 1, ops: [{ type: 'downscale', width: 100 }] })).toBeNull();
    expect(parsePreset({ id: 'a', name: 'x', version: 1, ops: [{ type: 'jpeg', quality: 0.01 }] })).toBeNull();
    expect(parsePreset({ id: 'a', name: 'x', version: 1, ops: [{ type: 'noise', amount: 2 }] })).toBeNull();
  });

  it('noise.shadow defaults to 0.5', () => {
    const preset = parsePreset({ id: 'a', name: 'x', version: 1, ops: [{ type: 'noise', amount: 0.3 }] });
    expect(preset?.ops[0]).toEqual({ type: 'noise', amount: 0.3, shadow: 0.5 });
  });

  it('clamps hue degrees into [0, 360) instead of rejecting', () => {
    const raw = { id: 'a', name: 'x', version: 1, ops: [{ type: 'hue', degrees: 370 }] };
    expect(parsePreset(raw)?.ops[0]).toEqual({ type: 'hue', degrees: 10 });
  });

  it('accepts a curve op with valid points, keeps optional channels', () => {
    const raw = {
      id: 'a', name: 'x', version: 1,
      ops: [{ type: 'curve', points: [[0, 34], [68, 62], [255, 245]], r: [[0, 0], [255, 255]] }],
    };
    expect(parsePreset(raw)?.ops[0]).toEqual({
      type: 'curve',
      points: [[0, 34], [68, 62], [255, 245]],
      r: [[0, 0], [255, 255]],
      g: undefined, b: undefined,
    });
  });

  it('rejects malformed curve points', () => {
    const base = { id: 'a', name: 'x', version: 1 };
    expect(parsePreset({ ...base, ops: [{ type: 'curve', points: [[0, 10]] }] })).toBeNull(); // < 2 points
    expect(parsePreset({ ...base, ops: [{ type: 'curve', points: [[10, 0], [255, 255]] }] })).toBeNull(); // must start at 0
    expect(parsePreset({ ...base, ops: [{ type: 'curve', points: [[0, 0], [200, 255]] }] })).toBeNull(); // must end at 255
    expect(parsePreset({ ...base, ops: [{ type: 'curve', points: [[0, 0], [0, 10], [255, 255]] }] })).toBeNull(); // rising ins
    expect(parsePreset({ ...base, ops: [{ type: 'curve', points: [[0, 0], [256, 255]] }] })).toBeNull(); // out of byte range
    expect(parsePreset({ ...base, ops: [{ type: 'curve', points: [[0, 0], [128, 300], [255, 255]] }] })).toBeNull();
  });

  it('accepts ca 0..1, rejects beyond', () => {
    expect(parsePreset({ id: 'a', name: 'x', version: 1, ops: [{ type: 'ca', amount: 0.5 }] })).not.toBeNull();
    expect(parsePreset({ id: 'a', name: 'x', version: 1, ops: [{ type: 'ca', amount: 1.2 }] })).toBeNull();
  });
});

describe('serializePreset', () => {
  it('round-trips through JSON without losing or changing meaning', () => {
    const raw = {
      id: 'abc',
      name: 'Круг',
      version: 1,
      ops: [
        { type: 'film', film: 'polaroid' },
        { type: 'contrast', amount: -0.3 },
        { type: 'hue', degrees: 15 },
      ],
    };
    const preset = parsePreset(raw)!;
    expect(parsePreset(JSON.parse(serializePreset(preset)))).toEqual(preset);
  });
});

describe('newPresetId', () => {
  it('gives distinct ids across calls', () => {
    expect(newPresetId()).not.toBe(newPresetId());
  });
});
