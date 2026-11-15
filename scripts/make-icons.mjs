// App icons: hue-diagonal gradient squares — same PNG encoder idea as the
// test fixture. Output: public/icons/{192,512}.png + public/apple-touch-icon.png
import { deflateSync } from 'node:zlib';
import { writeFileSync, mkdirSync } from 'node:fs';

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

function png(W, H, pixel) {
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(W, 0);
  ihdr.writeUInt32BE(H, 4);
  ihdr[8] = 8;
  ihdr[9] = 2;
  const scanlines = [];
  for (let y = 0; y < H; y++) {
    const row = Buffer.alloc(1 + W * 3);
    for (let x = 0; x < W; x++) {
      const [r, g, b] = pixel(x / (W - 1), y / (H - 1));
      row[1 + x * 3] = Math.round(r);
      row[2 + x * 3] = Math.round(g);
      row[3 + x * 3] = Math.round(b);
    }
    scanlines.push(row);
  }
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', ihdr),
    chunk('IDAT', deflateSync(Buffer.concat(scanlines))),
    chunk('IEND', Buffer.alloc(0)),
  ]);
}

// Warm quarter (amber) blending into a cool quarter (indigo) across the
// diagonal — reads as a tiny version of the hue-sweep brand.
const icon = (fx, fy) => {
  const t = (fx + fy) / 2;
  const warm = hslToRgb(0.09, 0.72, 0.55);
  const cool = hslToRgb(0.66, 0.55, 0.42);
  return [0, 1, 2].map((i) => warm[i] * (1 - t) + cool[i] * t);
};

mkdirSync('public/icons', { recursive: true });
for (const size of [192, 512]) {
  writeFileSync(`public/icons/icon-${size}.png`, png(size, size, icon));
}
writeFileSync('public/apple-touch-icon.png', png(180, 180, icon));
console.log('wrote public/icons/icon-{192,512}.png, public/apple-touch-icon.png');
