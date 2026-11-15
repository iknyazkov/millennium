// Deterministic test fixture: full hue sweep (left→right) with a
// lightness gradient (top→bottom). Written as a bare PNG — no deps.
// Output: public/test.png
import { deflateSync } from 'node:zlib';
import { writeFileSync, mkdirSync } from 'node:fs';

const W = 1200;
const H = 800;

function hslToRgb(h, s, l) {
  const c = (1 - Math.abs(2 * l - 1)) * s;
  const hp = h * 6;
  const x = c * (1 - Math.abs((hp % 2) - 1));
  let r = 0, g = 0, b = 0;
  if (hp < 1) [r, g, b] = [c, x, 0];
  else if (hp < 2) [r, g, b] = [x, c, 0];
  else if (hp < 3) [r, g, b] = [0, c, x];
  else if (hp < 4) [r, g, b] = [0, x, c];
  else if (hp < 5) [r, g, b] = [x, 0, c];
  else [r, g, b] = [c, 0, x];
  const m = l - c / 2;
  return [(r + m) * 255, (g + m) * 255, (b + m) * 255];
}

const crcTable = Array.from({ length: 256 }, (_, n) => {
  let c = n;
  for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
  return c >>> 0;
});

function crc32(buf) {
  let c = 0xffffffff;
  for (const byte of buf) c = crcTable[(c ^ byte) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

function chunk(type, data) {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length);
  const body = Buffer.concat([Buffer.from(type), data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(body));
  return Buffer.concat([len, body, crc]);
}

const ihdr = Buffer.alloc(13);
ihdr.writeUInt32BE(W, 0);
ihdr.writeUInt32BE(H, 4);
ihdr[8] = 8; // bit depth
ihdr[9] = 2; // color type: truecolor

const scanlines = [];
for (let y = 0; y < H; y++) {
  const row = Buffer.alloc(1 + W * 3);
  for (let x = 0; x < W; x++) {
    // s < 1 keeps pixels in the mid-tone mixing zone where film matrices
    // actually show (fully saturated hues just clamp at the channels' ends)
    const [r, g, b] = hslToRgb(x / (W - 1), 0.75, 0.85 - 0.6 * (y / (H - 1)));
    row[1 + x * 3] = Math.round(r);
    row[2 + x * 3] = Math.round(g);
    row[3 + x * 3] = Math.round(b);
  }
  scanlines.push(row);
}

const png = Buffer.concat([
  Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
  chunk('IHDR', ihdr),
  chunk('IDAT', deflateSync(Buffer.concat(scanlines))),
  chunk('IEND', Buffer.alloc(0)),
]);

mkdirSync('public', { recursive: true });
writeFileSync('public/test.png', png);
console.log(`wrote public/test.png (${W}x${H}, ${png.length} bytes)`);
