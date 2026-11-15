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
];

export const BUILTIN_PRESETS: Preset[] = RAW_BUILTINS.map((raw) => {
  const preset = parsePreset(raw);
  if (preset === null) {
    throw new Error('built-in preset failed its own schema — fix the literal');
  }
  return preset;
});
