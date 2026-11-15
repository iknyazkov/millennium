// Built-in presets ship as raw JSON literals and go through the same
// parsePreset boundary as anything from storage — one contract, no bypass.
import { parsePreset, type Preset } from './preset';

const RAW_BUILTINS: unknown[] = [
  {
    id: 'builtin-kodachrome',
    name: 'Kodachrome',
    version: 1,
    ops: [{ type: 'film', film: 'kodachrome' }],
  },
  {
    id: 'builtin-polaroid',
    name: 'Polaroid',
    version: 1,
    ops: [{ type: 'film', film: 'polaroid' }],
  },
  {
    id: 'builtin-vintage',
    name: 'Vintage',
    version: 1,
    ops: [
      { type: 'film', film: 'vintagePinhole' },
      { type: 'saturation', amount: -0.1 },
    ],
  },
  {
    id: 'builtin-technicolor',
    name: 'Technicolor',
    version: 1,
    ops: [
      { type: 'film', film: 'technicolor' },
      { type: 'brightness', amount: 0.05 },
    ],
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
    // (DigicamFilter reference: softness 22 / fade 21 / vignette 20).
    id: 'builtin-polaroid-sx70',
    name: 'Polaroid SX-70',
    version: 1,
    ops: [
      { type: 'grade', temp: 0.25, tint: 0.08, lift: 0.12, fade: 0.3 },
      { type: 'blur', radius: 0.8 },
      { type: 'vignette', amount: 0.5 },
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
