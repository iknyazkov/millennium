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

  it('clamps hue degrees into [0, 360) instead of rejecting', () => {
    const raw = { id: 'a', name: 'x', version: 1, ops: [{ type: 'hue', degrees: 370 }] };
    expect(parsePreset(raw)?.ops[0]).toEqual({ type: 'hue', degrees: 10 });
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
