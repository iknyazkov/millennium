// Render layer: translates the core Op list into the vendored engine's
// filter chain. The engine instance is reused across renders — it caches
// compiled shader programs, which is what keeps slider dragging fast.
import type { Op } from '../core/preset';
import '../vendor/webgl-image-filter.js';

type Engine = InstanceType<typeof window.WebGLImageFilter>;

let engine: Engine | null = null;

function getEngine() {
  if (engine === null) {
    engine = new window.WebGLImageFilter();
  }
  return engine;
}

/** Throws if the browser has no WebGL — the UI decides how to surface that. */
export function renderOps(image: TexImageSource, ops: Op[]): HTMLCanvasElement {
  const filter = getEngine();
  filter.reset();
  for (const op of ops) {
    switch (op.type) {
      case 'brightness':
      case 'saturation':
      case 'contrast':
        filter.addFilter(op.type, op.amount);
        break;
      case 'hue':
        filter.addFilter('hue', op.degrees);
        break;
      case 'film':
        filter.addFilter(op.film);
        break;
    }
  }
  return filter.apply(image);
}
