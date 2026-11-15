// Render pipeline: interprets the core Op list across three stages.
// Stage order is FIXED (documented contract of the op-list):
//   1. WebGL engine — color matrices (amount/hue/film/grade) + blur, in listed order
//   2. Own GL passes — vignette (LUT will join here)
//   3. 2D stage — downscale/noise/jpeg, in listed order
// Ops keep their relative order WITHIN a stage; a preset expresses a look,
// not a strict global sequence.
import { gradeToMatrix } from '../core/grade';
import type { Op } from '../core/preset';
import { applyVignette } from './passes';
import { run2DStage } from './stage2d';
import '../vendor/webgl-image-filter.js';

type Engine = InstanceType<typeof window.WebGLImageFilter>;
let engine: Engine | null = null;

type EngineOp = Extract<
  Op,
  { type: 'brightness' | 'saturation' | 'contrast' | 'hue' | 'film' | 'grade' | 'blur' }
>;
type Op2D = Extract<Op, { type: 'downscale' | 'noise' | 'jpeg' }>;

const isEngineOp = (op: Op): op is EngineOp =>
  'type' in op &&
  ['brightness', 'saturation', 'contrast', 'hue', 'film', 'grade', 'blur'].includes(op.type);

const is2DOp = (op: Op): op is Op2D =>
  op.type === 'downscale' || op.type === 'noise' || op.type === 'jpeg';

function getEngine(): Engine {
  if (engine === null) engine = new window.WebGLImageFilter();
  return engine;
}

function identityCanvas(image: TexImageSource): HTMLCanvasElement {
  const { width, height } = image as { width: number; height: number };
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  canvas.getContext('2d')!.drawImage(image as CanvasImageSource, 0, 0);
  return canvas;
}

function applyEngine(image: TexImageSource, ops: EngineOp[]): HTMLCanvasElement {
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
      case 'grade':
        filter.addFilter('colorMatrix', gradeToMatrix(op));
        break;
      case 'blur':
        filter.addFilter('blur', op.radius);
        break;
    }
  }
  return filter.apply(image);
}

/**
 * Full pipeline. Async because of the jpeg op (real encoder round-trip).
 * Throws if WebGL is unavailable — the UI decides how to surface that.
 */
export async function renderOps(image: TexImageSource, ops: Op[]): Promise<HTMLCanvasElement> {
  if (ops.length === 0) return identityCanvas(image);

  const engineOps = ops.filter(isEngineOp);
  let canvas = engineOps.length > 0 ? applyEngine(image, engineOps) : identityCanvas(image);

  const vignette = ops.find((op) => op.type === 'vignette');
  if (vignette && vignette.type === 'vignette') {
    canvas = applyVignette(canvas, vignette.amount);
  }

  const ops2D = ops.filter(is2DOp);
  if (ops2D.length > 0) {
    canvas = await run2DStage(canvas, ops2D);
  }
  return canvas;
}
