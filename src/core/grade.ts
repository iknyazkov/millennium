// Pure color-grade math: a perceptual parametrization compiled into a
// 5x4 color matrix (the 20-value convention of WebGLImageFilter.colorMatrix,
// where the 5th column is an offset that the engine divides by 255).

export type Grade = {
  /** -1 cool → 0 neutral → 1 warm. Scales R up / B down. */
  temp: number; // -1..1
  /** -1 magenta → 0 neutral → 1 green bias. */
  tint: number; // -1..1
  /** Raise blacks, warm-biased (Garcia's Twin Peaks recipe: shadows go
   * yellow-orange, not neutral). 0 = none, 1 = strong. */
  lift: number; // 0..1
  /** Compress highlights down (faded film rolloff). 0 = none, 1 = strong. */
  fade: number; // 0..1
};

const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));

/** Offsets are in 0-255 units (engine convention). */
export function gradeToMatrix({ temp, tint, lift, fade }: Grade): number[] {
  // Channel gains from temperature/tint
  const rGain = 1 + 0.25 * clamp(temp, -1, 1);
  const bGain = 1 - 0.25 * clamp(temp, -1, 1);
  const gGain = 1 + 0.12 * clamp(tint, -1, 1);
  const tintCross = -0.06 * clamp(tint, -1, 1); // magenta↔green cross-talk

  // Warm-biased lift: shadows get R > G > B offsets (yellow-orange cast)
  const lift255 = 38 * clamp(lift, 0, 1);
  const offR = lift255;
  const offG = lift255 * 0.8;
  const offB = lift255 * 0.55;

  // Fade: scale everything down a touch so highlights land below 255.
  // Gains < 1 with the same offsets = classic faded-film S-flatten.
  const fadeGain = 1 - 0.25 * clamp(fade, 0, 1);

  const z = (v: number) => (v === 0 ? 0 : v); // normalize -0 → 0
  return [
    rGain * fadeGain, tintCross, tintCross, 0, offR,
    tintCross, gGain * fadeGain, tintCross, 0, offG,
    tintCross, tintCross, bGain * fadeGain, 0, offB,
    0, 0, 0, 1, 0,
  ].map(z);
}
