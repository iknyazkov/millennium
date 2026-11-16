// Tone-curve math for the `curve` op: XMP control points → 256-entry LUT.
// Pure functions — the GL pass only consumes the built LUTs.
export type CurvePoints = [number, number][];

/** Linear interpolation between control points → 256-entry LUT. */
export function buildLut(points: CurvePoints): Uint8Array {
  const lut = new Uint8Array(256);
  for (let i = 0; i < points.length - 1; i++) {
    const [x0, y0] = points[i];
    const [x1, y1] = points[i + 1];
    for (let x = x0; x <= x1; x++) {
      const t = x1 === x0 ? 0 : (x - x0) / (x1 - x0);
      lut[x] = clampByte(y0 + t * (y1 - y0));
    }
  }
  lut[255] = clampByte(points[points.length - 1][1]);
  return lut;
}

/**
 * Lightroom order: the RGB (composite) curve applies first, then the
 * per-channel curve on its output — result[x] = channel(composite(x)).
 */
export function composeLuts(composite: Uint8Array, channel: Uint8Array): Uint8Array {
  const out = new Uint8Array(256);
  for (let x = 0; x < 256; x++) out[x] = channel[composite[x]];
  return out;
}

/** LUTs for all three channels; identity curves fall through untouched. */
export function buildChannelLuts(curve: {
  points: CurvePoints;
  r?: CurvePoints;
  g?: CurvePoints;
  b?: CurvePoints;
}): { r: Uint8Array; g: Uint8Array; b: Uint8Array } {
  const composite = buildLut(curve.points);
  const per = (p?: CurvePoints) => (p ? composeLuts(composite, buildLut(p)) : composite);
  return { r: per(curve.r), g: per(curve.g), b: per(curve.b) };
}

const clampByte = (v: number) => (v < 0 ? 0 : v > 255 ? 255 : Math.round(v));
