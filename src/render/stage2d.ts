// 2D-stage ops, executed in listed order. These are the ops that need
// canvas 2D (or real encoders) rather than shaders — for the VGA look the
// ORDER is the authenticity: downscale → noise → jpeg, like a real sensor.
import type { Op } from '../core/preset';

type Op2D = Extract<Op, { type: 'downscale' | 'noise' | 'jpeg' }>;

export async function run2DStage(
  source: HTMLCanvasElement,
  ops: Op2D[],
): Promise<HTMLCanvasElement> {
  // The source may be a WebGL canvas (own GL passes) — its getContext('2d')
  // is null forever. Copy through a 2D canvas once, then work in 2D.
  let canvas = ensure2D(source);
  for (const op of ops) {
    if (op.type === 'downscale') canvas = downscale(canvas, op.width);
    else if (op.type === 'noise') addNoise(canvas, op.amount, op.shadow);
    else canvas = await jpegReencode(canvas, op.quality);
  }
  return canvas;
}

function ensure2D(source: HTMLCanvasElement): HTMLCanvasElement {
  if (source.getContext('2d') !== null) return source;
  const copy = document.createElement('canvas');
  copy.width = source.width;
  copy.height = source.height;
  copy.getContext('2d')!.drawImage(source, 0, 0);
  return copy;
}

/** Never upscales: width >= current width is a no-op. */
function downscale(source: HTMLCanvasElement, targetWidth: number): HTMLCanvasElement {
  if (targetWidth >= source.width) return source;
  const target = document.createElement('canvas');
  target.width = targetWidth;
  target.height = Math.round((source.height * targetWidth) / source.width);
  const ctx = target.getContext('2d')!;
  ctx.imageSmoothingQuality = 'high';
  ctx.drawImage(source, 0, 0, target.width, target.height);
  return target;
}

/** Luminance noise, optionally weighted toward shadows (small sensors =
 * less light per pixel = noisy shadows). In-place, cheap at VGA resolution. */
function addNoise(canvas: HTMLCanvasElement, amount: number, shadow: number): void {
  const ctx = canvas.getContext('2d')!;
  const img = ctx.getImageData(0, 0, canvas.width, canvas.height);
  const d = img.data;
  for (let i = 0; i < d.length; i += 4) {
    const luma = (0.299 * d[i] + 0.587 * d[i + 1] + 0.114 * d[i + 2]) / 255;
    const weight = 1 * (1 - shadow) + (1 - luma) * shadow;
    const n = (Math.random() - 0.5) * 2 * amount * weight * 90;
    d[i] = clampByte(d[i] + n);
    d[i + 1] = clampByte(d[i + 1] + n);
    d[i + 2] = clampByte(d[i + 2] + n);
  }
  ctx.putImageData(img, 0, 0);
}

/** Real JPEG artifacts by construction: encode at low quality, decode back. */
async function jpegReencode(canvas: HTMLCanvasElement, quality: number): Promise<HTMLCanvasElement> {
  const blob: Blob = await new Promise((resolve) =>
    canvas.toBlob((b) => resolve(b!), 'image/jpeg', quality),
  );
  const bitmap = await createImageBitmap(blob);
  const target = document.createElement('canvas');
  target.width = bitmap.width;
  target.height = bitmap.height;
  target.getContext('2d')!.drawImage(bitmap, 0, 0);
  bitmap.close();
  return target;
}

const clampByte = (v: number) => (v < 0 ? 0 : v > 255 ? 255 : v);
