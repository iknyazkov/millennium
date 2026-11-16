// Core: preset schema. Pure TypeScript — no DOM, no storage, no engine.
// Glossary: Preset = named op-list (user artifact); Op = one operation;
// "film" ops map 1:1 to WebGLImageFilter's baked recipes.

import type { CurvePoints } from './curve';

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

export type GradeOp = {
  type: 'grade';
  temp: number; // -1..1, warm→cool
  tint: number; // -1..1, magenta→green
  lift: number; // 0..1, warm-biased black lift
  fade: number; // 0..1, highlight compression
};

export type Op =
  | { type: AmountOpType; amount: number }
  | { type: 'hue'; degrees: number }
  | { type: 'film'; film: FilmName }
  | GradeOp
  | { type: 'curve'; points: CurvePoints; r?: CurvePoints; g?: CurvePoints; b?: CurvePoints }
  | { type: 'blur'; radius: number } // 0..10 px
  | { type: 'vignette'; amount: number } // 0..1
  | { type: 'ca'; amount: number } // 0..1, radial chromatic aberration
  | { type: 'downscale'; width: number } // 320..4096 px
  | { type: 'noise'; amount: number; shadow: number } // both 0..1
  | { type: 'jpeg'; quality: number }; // 0.05..0.95

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

function inRange(v: unknown, lo: number, hi: number): v is number {
  return typeof v === 'number' && Number.isFinite(v) && v >= lo && v <= hi;
}

/** XMP-style control points: [in,out] ints 0..255, in strictly rising, 0..255 span. */
function isCurvePoints(v: unknown): v is CurvePoints {
  if (!Array.isArray(v) || v.length < 2) return false;
  let prevIn = -1;
  for (const p of v) {
    if (!Array.isArray(p) || p.length !== 2) return false;
    const [x, y] = p;
    if (!Number.isInteger(x) || !Number.isInteger(y)) return false;
    if (!inRange(x, 0, 255) || !inRange(y, 0, 255)) return false;
    if (x <= prevIn) return false;
    prevIn = x;
  }
  return v[0][0] === 0 && v[v.length - 1][0] === 255;
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

    if (o.type === 'grade') {
      const temp = o.temp ?? 0;
      const tint = o.tint ?? 0;
      const lift = o.lift ?? 0;
      const fade = o.fade ?? 0;
      if (!inRange(temp, -1, 1) || !inRange(tint, -1, 1)) return null;
      if (!inRange(lift, 0, 1) || !inRange(fade, 0, 1)) return null;
      parsedOps.push({ type: 'grade', temp, tint, lift, fade });
      continue;
    }

    if (o.type === 'curve') {
      if (!isCurvePoints(o.points)) return null;
      const r = o.r === undefined ? undefined : isCurvePoints(o.r) ? o.r : null;
      const g = o.g === undefined ? undefined : isCurvePoints(o.g) ? o.g : null;
      const b = o.b === undefined ? undefined : isCurvePoints(o.b) ? o.b : null;
      if (r === null || g === null || b === null) return null;
      parsedOps.push({ type: 'curve', points: o.points, r, g, b });
      continue;
    }

    if (o.type === 'ca') {
      if (!inRange(o.amount, 0, 1)) return null;
      parsedOps.push({ type: 'ca', amount: o.amount });
      continue;
    }

    if (o.type === 'blur') {
      if (typeof o.radius !== 'number' || !inRange(o.radius, 0, 10)) return null;
      parsedOps.push({ type: 'blur', radius: o.radius });
      continue;
    }

    if (o.type === 'vignette') {
      if (typeof o.amount !== 'number' || !inRange(o.amount, 0, 1)) return null;
      parsedOps.push({ type: 'vignette', amount: o.amount });
      continue;
    }

    if (o.type === 'downscale') {
      if (typeof o.width !== 'number' || !Number.isInteger(o.width) || !inRange(o.width, 320, 4096)) return null;
      parsedOps.push({ type: 'downscale', width: o.width });
      continue;
    }

    if (o.type === 'noise') {
      const shadow = o.shadow ?? 0.5;
      if (!inRange(o.amount, 0, 1) || !inRange(shadow, 0, 1)) return null;
      parsedOps.push({ type: 'noise', amount: o.amount, shadow });
      continue;
    }

    if (o.type === 'jpeg') {
      if (typeof o.quality !== 'number' || !inRange(o.quality, 0.05, 0.95)) return null;
      parsedOps.push({ type: 'jpeg', quality: o.quality });
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
