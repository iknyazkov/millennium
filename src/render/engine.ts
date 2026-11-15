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
  // Empty chain is not passed to the engine: its no-filter path draws into
  // an intermediate framebuffer (upstream quirk — _lastInChain stays false)
  // and the visible canvas comes out black. Identity is trivial on a 2D canvas.
  if (ops.length === 0) {
    const { width, height } = image as { width: number; height: number };
    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    canvas.getContext('2d')!.drawImage(image as CanvasImageSource, 0, 0);
    return canvas;
  }
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
