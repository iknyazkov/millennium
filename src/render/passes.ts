// Own minimal GL passes that the vendored engine doesn't have.
// One cached context, one quad, programs compiled once and reused.
import type { CurvePoints } from '../core/curve';
import { buildChannelLuts } from '../core/curve';

const VERT = `
attribute vec2 a_pos;
varying vec2 vUv;
void main() {
  vUv = a_pos * 0.5 + 0.5;
  gl_Position = vec4(a_pos, 0.0, 1.0);
}`;

const VIGNETTE_FRAG = `
precision mediump float;
varying vec2 vUv;
uniform sampler2D u_tex;
uniform float u_amount;
uniform float u_aspect;
void main() {
  vec4 c = texture2D(u_tex, vUv);
  vec2 d = (vUv - 0.5) * vec2(u_aspect, 1.0);
  float dist = length(d) * 1.35; // 0 at center, ~0.95 at corners
  float falloff = smoothstep(0.95, 0.25, dist);
  gl_FragColor = vec4(c.rgb * mix(1.0, falloff, u_amount), c.a);
}`;

// Per-channel tone LUTs: 256x1 LUMINANCE textures, one per channel.
const CURVE_FRAG = `
precision mediump float;
varying vec2 vUv;
uniform sampler2D u_tex;
uniform sampler2D u_lutR;
uniform sampler2D u_lutG;
uniform sampler2D u_lutB;
void main() {
  vec4 c = texture2D(u_tex, vUv);
  gl_FragColor = vec4(
    texture2D(u_lutR, vec2(c.r, 0.5)).r,
    texture2D(u_lutG, vec2(c.g, 0.5)).r,
    texture2D(u_lutB, vec2(c.b, 0.5)).r,
    c.a
  );
}`;

// Radial chromatic aberration: R and B sampled at opposite radial offsets,
// green untouched — like a simple lens, worst at the corners.
const CA_FRAG = `
precision mediump float;
varying vec2 vUv;
uniform sampler2D u_tex;
uniform float u_amount;
void main() {
  // Scale 0.03: at amount 0.5 the R/B separation reaches ~1.5% of the frame
  // diagonal at the corners — visible fringing on edges, like the plastic
  // SX-70 lens. 0.02 was lost under the preset's own blur.
  vec2 off = (vUv - 0.5) * u_amount * 0.03;
  gl_FragColor = vec4(
    texture2D(u_tex, vUv + off).r,
    texture2D(u_tex, vUv).g,
    texture2D(u_tex, vUv - off).b,
    1.0
  );
}`;

type GlKit = {
  canvas: HTMLCanvasElement;
  gl: WebGLRenderingContext;
  quad: WebGLBuffer;
  programs: Map<string, WebGLProgram>;
};

let kit: GlKit | null = null;

function buildKit(): GlKit {
  const canvas = document.createElement('canvas');
  const gl = canvas.getContext('webgl')!;
  const quad = gl.createBuffer()!;
  gl.bindBuffer(gl.ARRAY_BUFFER, quad);
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]), gl.STATIC_DRAW);
  return { canvas, gl, quad, programs: new Map() };
}

function program(kit: GlKit, name: string, frag: string): WebGLProgram {
  const cached = kit.programs.get(name);
  if (cached) return cached;
  const { gl } = kit;
  const compile = (type: number, src: string) => {
    const sh = gl.createShader(type)!;
    gl.shaderSource(sh, src);
    gl.compileShader(sh);
    return sh;
  };
  const p = gl.createProgram()!;
  gl.attachShader(p, compile(gl.VERTEX_SHADER, VERT));
  gl.attachShader(p, compile(gl.FRAGMENT_SHADER, frag));
  gl.linkProgram(p);
  kit.programs.set(name, p);
  return p;
}

/** Common prologue: size the target, upload the source, bind the quad. */
function beginPass(kit: GlKit, program: WebGLProgram, source: HTMLCanvasElement): WebGLTexture {
  const { canvas, gl, quad } = kit;
  // Assigning width/height resets the bitmap — skip when unchanged, or a
  // pass chained after another (source === our own canvas) would clear
  // itself before the texImage2D read below.
  if (canvas.width !== source.width) canvas.width = source.width;
  if (canvas.height !== source.height) canvas.height = source.height;
  gl.viewport(0, 0, canvas.width, canvas.height);

  // lutTexture() may have left another unit active — the source always
  // goes to unit 0, where every pass's u_tex looks.
  gl.activeTexture(gl.TEXTURE0);
  const tex = gl.createTexture()!;
  gl.bindTexture(gl.TEXTURE_2D, tex);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
  // texImage2D puts row 0 at v=0, but v=0 is the BOTTOM of the framebuffer —
  // without the flip the pass renders the image upside down.
  gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, true);
  gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, source);

  gl.useProgram(program);
  const pos = gl.getAttribLocation(program, 'a_pos');
  gl.bindBuffer(gl.ARRAY_BUFFER, quad);
  gl.enableVertexAttribArray(pos);
  gl.vertexAttribPointer(pos, 2, gl.FLOAT, false, 0, 0);
  return tex;
}

function lutTexture(gl: WebGLRenderingContext, lut: Uint8Array, unit: number): WebGLTexture {
  const tex = gl.createTexture()!;
  gl.activeTexture(gl.TEXTURE0 + unit);
  gl.bindTexture(gl.TEXTURE_2D, tex);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
  gl.texImage2D(gl.TEXTURE_2D, 0, gl.LUMINANCE, 256, 1, 0, gl.LUMINANCE, gl.UNSIGNED_BYTE, lut);
  return tex;
}

/** Vignette pass: darkens edges by `amount` (0..1), aspect-corrected. */
export function applyVignette(source: HTMLCanvasElement, amount: number): HTMLCanvasElement {
  if (kit === null) kit = buildKit();
  const { gl } = kit;
  const p = program(kit, 'vignette', VIGNETTE_FRAG);
  const tex = beginPass(kit, p, source);
  gl.uniform1i(gl.getUniformLocation(p, 'u_tex'), 0);
  gl.uniform1f(gl.getUniformLocation(p, 'u_amount'), amount);
  gl.uniform1f(gl.getUniformLocation(p, 'u_aspect'), source.width / source.height);
  gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
  gl.deleteTexture(tex);
  return kit.canvas;
}

/** Tone-curve pass: applies composed per-channel LUTs built from XMP points. */
export function applyCurves(
  source: HTMLCanvasElement,
  curve: { points: CurvePoints; r?: CurvePoints; g?: CurvePoints; b?: CurvePoints },
): HTMLCanvasElement {
  if (kit === null) kit = buildKit();
  const { gl } = kit;
  const p = program(kit, 'curve', CURVE_FRAG);
  const tex = beginPass(kit, p, source);
  const luts = buildChannelLuts(curve);
  const lutR = lutTexture(gl, luts.r, 1);
  const lutG = lutTexture(gl, luts.g, 2);
  const lutB = lutTexture(gl, luts.b, 3);
  gl.uniform1i(gl.getUniformLocation(p, 'u_tex'), 0);
  gl.uniform1i(gl.getUniformLocation(p, 'u_lutR'), 1);
  gl.uniform1i(gl.getUniformLocation(p, 'u_lutG'), 2);
  gl.uniform1i(gl.getUniformLocation(p, 'u_lutB'), 3);
  gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
  gl.deleteTexture(tex);
  gl.deleteTexture(lutR);
  gl.deleteTexture(lutG);
  gl.deleteTexture(lutB);
  return kit.canvas;
}

/** Chromatic aberration pass: radial R/B split by `amount` (0..1). */
export function applyCA(source: HTMLCanvasElement, amount: number): HTMLCanvasElement {
  if (kit === null) kit = buildKit();
  const { gl } = kit;
  const p = program(kit, 'ca', CA_FRAG);
  const tex = beginPass(kit, p, source);
  gl.uniform1i(gl.getUniformLocation(p, 'u_tex'), 0);
  gl.uniform1f(gl.getUniformLocation(p, 'u_amount'), amount);
  gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
  gl.deleteTexture(tex);
  return kit.canvas;
}
