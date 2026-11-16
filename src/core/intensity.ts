// Core: intensity transform. Scales every op's amplitude toward its
// neutral point, so the whole look can be dialed from "off" (0) through
// the preset as authored (1) up to pushed-past-authored (2). Pure —
// like grade.ts, no DOM, no engine. The scaled list only ever feeds the
// renderer: it is never stored, parsed or compared for preset identity.
import type { CurvePoints } from './curve';
import type { FilmName, Op } from './preset';

export const INTENSITY_MIN = 0;
export const INTENSITY_MAX = 2;

/**
 * The vendored film recipes are plain 5x4 color matrices (offset column
 * in 0-255 units — the engine's colorMatrix convention), mirrored here so
 * a scaled film can blend toward identity. Blending is exact, not an
 * approximation: for any pixel x, ((1-t)·I + t·M)(x) = (1-t)·x + t·M(x).
 */
const FILM_MATRICES: Record<FilmName, number[]> = {
  sepia: [
    0.393, 0.7689999, 0.18899999, 0, 0,
    0.349, 0.6859999, 0.16799999, 0, 0,
    0.272, 0.5339999, 0.13099999, 0, 0,
    0, 0, 0, 1, 0,
  ],
  brownie: [
    0.5997023498159715, 0.34553243048391263, -0.2708298674538042, 0, 47.43192855600873,
    -0.037703249837783157, 0.8609577587992641, 0.15059552388459913, 0, -36.96841498319127,
    0.24113635128153335, -0.07441037908422492, 0.44972182064877153, 0, -7.562075277591283,
    0, 0, 0, 1, 0,
  ],
  vintagePinhole: [
    0.6279345635605994, 0.3202183420819367, -0.03965408211312453, 0, 9.651285835294123,
    0.02578397704808868, 0.6441188644374771, 0.03259127616149294, 0, 7.462829176470591,
    0.0466055556782719, -0.0851232987247891, 0.5241648018700465, 0, 5.159190588235296,
    0, 0, 0, 1, 0,
  ],
  kodachrome: [
    1.1285582396593525, -0.3967382283601348, -0.03992559172921793, 0, 63.72958762196502,
    -0.16404339962244616, 1.0835251566291304, -0.05498805115633132, 0, 24.732407896706203,
    -0.16786010706155763, -0.5603416277695248, 1.6014850761964943, 0, 35.62982807460946,
    0, 0, 0, 1, 0,
  ],
  technicolor: [
    1.9125277891456083, -0.8545344976951645, -0.09155508482755585, 0, 11.793603434377337,
    -0.3087833385928097, 1.7658908555458428, -0.10601743074722245, 0, -70.35205161461398,
    -0.231103377548616, -0.7501899197440212, 1.847597816108189, 0, 30.950940869491138,
    0, 0, 0, 1, 0,
  ],
  polaroid: [
    1.438, -0.062, -0.062, 0, 0,
    -0.122, 1.378, -0.122, 0, 0,
    -0.016, -0.016, 1.483, 0, 0,
    0, 0, 0, 1, 0,
  ],
};

const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));
const lerp = (neutral: number, value: number, t: number) => neutral + (value - neutral) * t;

/** Curve intensity: pull each output value toward its own input (identity). */
function scalePoints(points: CurvePoints, t: number): CurvePoints {
  return points.map(([x, y]) => [x, Math.round(clamp(lerp(x, y, t), 0, 255))]);
}

/** Blend a matrix toward identity (ones at 0, 6, 12, 18) by t. */
function blendMatrix(m: number[], t: number): number[] {
  const identity = (i: number) => (i === 0 || i === 6 || i === 12 || i === 18 ? 1 : 0);
  return m.map((v, i) => lerp(identity(i), v, t));
}

/** Blend a film's baked matrix toward identity by t, as a colorMatrix op. */
function scaleFilm(film: FilmName, t: number): Op {
  return { type: 'colorMatrix', matrix: blendMatrix(FILM_MATRICES[film], t) };
}

/**
 * t = 0 → [] (untouched photo). t = 1 → ops unchanged. Otherwise every
 * amplitude scales toward neutral and clamps to the schema's own bounds —
 * the slider extrapolates within the same limits a hand-written preset has.
 * `downscale` is structural, not a look strength — it survives unchanged
 * (and dies with everything else at t = 0).
 */
export function applyIntensity(ops: Op[], tRaw: number): Op[] {
  const t = clamp(tRaw, INTENSITY_MIN, INTENSITY_MAX);
  if (ops.length === 0) return ops;
  if (t === 1) return ops;

  if (t === 0) return [];

  return ops.map((op): Op => {
    switch (op.type) {
      case 'brightness':
      case 'saturation':
      case 'contrast':
        return { type: op.type, amount: clamp(op.amount * t, -1, 1) };
      case 'hue':
        return { type: 'hue', degrees: op.degrees * t };
      case 'film':
        return scaleFilm(op.film, t);
      case 'colorMatrix':
        return { type: 'colorMatrix', matrix: blendMatrix(op.matrix, t) };
      case 'grade':
        return {
          type: 'grade',
          temp: clamp(op.temp * t, -1, 1),
          tint: clamp(op.tint * t, -1, 1),
          lift: clamp(op.lift * t, 0, 1),
          fade: clamp(op.fade * t, 0, 1),
        };
      case 'curve':
        return {
          type: 'curve',
          points: scalePoints(op.points, t),
          r: op.r && scalePoints(op.r, t),
          g: op.g && scalePoints(op.g, t),
          b: op.b && scalePoints(op.b, t),
        };
      case 'blur':
        return { type: 'blur', radius: clamp(op.radius * t, 0, 10) };
      case 'vignette':
        return { type: 'vignette', amount: clamp(op.amount * t, 0, 1) };
      case 'ca':
        return { type: 'ca', amount: clamp(op.amount * t, 0, 1) };
      case 'downscale':
        return op;
      case 'noise':
        return {
          type: 'noise',
          amount: clamp(op.amount * t, 0, 1),
          shadow: clamp(lerp(0.5, op.shadow, t), 0, 1),
        };
      case 'jpeg':
        // Neutral is lossless quality 1; artifacts grow as t does.
        return { type: 'jpeg', quality: clamp(lerp(1, op.quality, t), 0.05, 1) };
    }
  });
}
