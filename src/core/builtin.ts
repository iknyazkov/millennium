// Built-in presets ship as raw JSON literals and go through the same
// parsePreset boundary as anything from storage — one contract, no bypass.
import { parsePreset, type Preset } from './preset';

const RAW_BUILTINS: unknown[] = [
  {
    id: 'builtin-polaroid',
    name: 'Polaroid',
    version: 1,
    ops: [{ type: 'film', film: 'polaroid' }],
  },
  {
    // Ron Garcia's recipe (THR): warm not teal, shadows shifted
    // yellow-orange (Wratten 85 + LLC), lifted Fuji-style shadows,
    // muted "mysterious, not weird" saturation, soft dreamy blur.
    id: 'builtin-twin-peaks',
    name: 'Twin Peaks',
    version: 1,
    ops: [
      { type: 'grade', temp: 0.55, tint: 0.1, lift: 0.5, fade: 0.3 },
      { type: 'saturation', amount: -0.25 },
      { type: 'blur', radius: 2.2 },
    ],
  },
  {
    // SX-70 approximation until the real PictureFX .cube lands: faded
    // contrast, creamy highlights (fade), warm lift, softness + vignette
    // (DigicamFilter reference: softness 22 / fade 21 / vignette 20) and
    // the plastic-lens chromatic aberration in the corners.
    id: 'builtin-polaroid-sx70',
    name: 'Polaroid SX-70',
    version: 1,
    ops: [
      { type: 'grade', temp: 0.25, tint: 0.08, lift: 0.12, fade: 0.3 },
      { type: 'blur', radius: 0.8 },
      { type: 'vignette', amount: 0.5 },
      { type: 'ca', amount: 0.5 },
    ],
  },
  {
    // From the user's Lightroom XMP: lifted blacks / compressed whites
    // (composite curve), Exposure +0.30, net-muted greens&oranges, warm
    // hue drift, Grain 13, PostCrop vignette −10. Skin-friendly softness.
    id: 'builtin-portra-160',
    name: 'Portra 160',
    version: 1,
    ops: [
      { type: 'curve', points: [[0, 34], [68, 62], [255, 245]] },
      { type: 'brightness', amount: 0.06 },
      { type: 'saturation', amount: -0.08 },
      { type: 'hue', degrees: -5 },
      { type: 'vignette', amount: 0.12 },
      { type: 'noise', amount: 0.12, shadow: 0.6 },
    ],
  },
  {
    // From the user's Lightroom XMP: per-channel S-curves are the whole
    // point of Ektar — low-mids pushed apart per channel = saturated
    // punch — plus strong highlight/shadow compression in the composite.
    id: 'builtin-ektar-100',
    name: 'Ektar 100',
    version: 1,
    ops: [
      {
        type: 'curve',
        points: [[0, 24], [82, 90], [255, 253]],
        r: [[0, 0], [44, 11], [70, 38], [96, 88], [147, 179], [191, 223], [255, 255]],
        g: [[0, 0], [28, 7], [61, 35], [92, 82], [149, 181], [189, 221], [255, 255]],
        b: [[0, 0], [24, 10], [93, 82], [148, 177], [198, 226], [255, 255]],
      },
      { type: 'saturation', amount: 0.06 },
    ],
  },
  {
    // Early-2000s VGA phone stack (dev.to + CoreCam): the order IS the
    // authenticity — sensor downscale, shadow-heavy grain, REAL jpeg
    // artifacts, narrow DR, CCD cyan-green cast.
    id: 'builtin-vga-phone',
    name: 'Телефон 2003',
    version: 1,
    ops: [
      { type: 'grade', temp: -0.2, tint: 0.12, lift: 0.05, fade: 0.3 },
      { type: 'vignette', amount: 0.2 },
      { type: 'downscale', width: 640 },
      { type: 'noise', amount: 0.4, shadow: 0.7 },
      { type: 'jpeg', quality: 0.25 },
    ],
  },
];

export const BUILTIN_PRESETS: Preset[] = RAW_BUILTINS.map((raw) => {
  const preset = parsePreset(raw);
  if (preset === null) {
    throw new Error('built-in preset failed its own schema — fix the literal');
  }
  return preset;
});
