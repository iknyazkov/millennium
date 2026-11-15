// Core: preset schema. Pure TypeScript — no DOM, no storage, no engine.
// Glossary: Preset = named op-list (user artifact); Op = one operation;
// "film" ops map 1:1 to WebGLImageFilter's baked recipes.

export const PRESET_SCHEMA_VERSION = 1;

export const FILM_NAMES = [
  'sepia',
  'brownie',
  'vintagePinhole',
  'kodachrome',
  'technicolor',
  'polaroid',
] as const;

export type FilmName = (typeof FILM_NAMES)[number];

/** Amount ops are slider-like: -1..1, 0 = neutral. */
export type AmountOpType = 'brightness' | 'saturation' | 'contrast';

export type Op =
  | { type: AmountOpType; amount: number }
  | { type: 'hue'; degrees: number }
  | { type: 'film'; film: FilmName };

export type Preset = {
  id: string;
  name: string;
  version: typeof PRESET_SCHEMA_VERSION;
  ops: Op[];
};

function isAmountOpType(v: unknown): v is AmountOpType {
  return v === 'brightness' || v === 'saturation' || v === 'contrast';
}

function isFilmName(v: unknown): v is FilmName {
  return typeof v === 'string' && (FILM_NAMES as readonly string[]).includes(v);
}

/**
 * Boundary: outside data (IndexedDB, future sync, hand-edited JSON) is
 * validated exactly once, here. Inside the app a Preset is trusted.
 * Hue is clamped (it wraps at 360); everything else is strict — a bad
 * value means a corrupt preset, and we refuse rather than half-apply it.
 */
export function parsePreset(raw: unknown): Preset | null {
  if (typeof raw !== 'object' || raw === null) return null;
  const { id, name, version, ops } = raw as Record<string, unknown>;

  if (typeof id !== 'string' || id.length === 0) return null;
  if (typeof name !== 'string') return null;
  if (version !== PRESET_SCHEMA_VERSION) return null;
  if (!Array.isArray(ops)) return null;

  const parsedOps: Op[] = [];
  for (const op of ops) {
    if (typeof op !== 'object' || op === null) return null;
    const o = op as Record<string, unknown>;

    if (isAmountOpType(o.type)) {
      if (typeof o.amount !== 'number' || !Number.isFinite(o.amount)) return null;
      if (o.amount < -1 || o.amount > 1) return null;
      parsedOps.push({ type: o.type, amount: o.amount });
      continue;
    }

    if (o.type === 'hue') {
      if (typeof o.degrees !== 'number' || !Number.isFinite(o.degrees)) return null;
      const degrees = ((o.degrees % 360) + 360) % 360;
      parsedOps.push({ type: 'hue', degrees });
      continue;
    }

    if (o.type === 'film') {
      if (!isFilmName(o.film)) return null;
      parsedOps.push({ type: 'film', film: o.film });
      continue;
    }

    return null;
  }

  return { id, name, version, ops: parsedOps };
}

export function serializePreset(preset: Preset): string {
  return JSON.stringify(preset);
}

export function newPresetId(): string {
  return crypto.randomUUID();
}
