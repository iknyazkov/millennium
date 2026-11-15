// Own minimal GL passes that the vendored engine doesn't have.
// One cached context, one program per pass — compiled once, reused.
// (LUT sampling will join this file when the real .cube lands.)

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

const VERT = `
attribute vec2 a_pos;
varying vec2 vUv;
void main() {
  vUv = a_pos * 0.5 + 0.5;
  gl_Position = vec4(a_pos, 0.0, 1.0);
}`;

type GlKit = {
  canvas: HTMLCanvasElement;
  gl: WebGLRenderingContext;
  program: WebGLProgram;
  quad: WebGLBuffer;
};

let kit: GlKit | null = null;

function buildKit(frag: string): GlKit {
  const canvas = document.createElement('canvas');
  const gl = canvas.getContext('webgl')!;

  const compile = (type: number, src: string) => {
    const sh = gl.createShader(type)!;
    gl.shaderSource(sh, src);
    gl.compileShader(sh);
    return sh;
  };
  const program = gl.createProgram()!;
  gl.attachShader(program, compile(gl.VERTEX_SHADER, VERT));
  gl.attachShader(program, compile(gl.FRAGMENT_SHADER, frag));
  gl.linkProgram(program);

  const quad = gl.createBuffer()!;
  gl.bindBuffer(gl.ARRAY_BUFFER, quad);
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]), gl.STATIC_DRAW);

  return { canvas, gl, program, quad };
}

/** Vignette pass: darkens edges by `amount` (0..1), aspect-corrected. */
export function applyVignette(source: HTMLCanvasElement, amount: number): HTMLCanvasElement {
  if (kit === null) kit = buildKit(VIGNETTE_FRAG);
  const { canvas, gl, program, quad } = kit;

  canvas.width = source.width;
  canvas.height = source.height;
  gl.viewport(0, 0, canvas.width, canvas.height);

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
  gl.uniform1i(gl.getUniformLocation(program, 'u_tex'), 0);
  gl.uniform1f(gl.getUniformLocation(program, 'u_amount'), amount);
  gl.uniform1f(gl.getUniformLocation(program, 'u_aspect'), canvas.width / canvas.height);

  gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
  gl.deleteTexture(tex);
  return canvas;
}
