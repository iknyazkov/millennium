// Walking-skeleton smoke: open photo -> apply preset -> no console errors.
// Usage: npm run dev (in another shell), then node scripts/smoke.mjs
import { chromium } from 'playwright';
import { mkdirSync } from 'node:fs';

const URL = process.env.SMOKE_URL ?? 'http://localhost:5173/';

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1100, height: 800 } });
const errors = [];
page.on('console', (m) => {
  if (m.type() === 'error') errors.push(m.text());
});
page.on('pageerror', (e) => errors.push(String(e)));

await page.goto(URL, { waitUntil: 'networkidle' });
await page.getByText('Фотография не покидает устройство').waitFor();

// Feed the file through the real file chooser, as a user would
// (the empty-state pill; the nav "Открыть фото" is a label, not a button)
const chooser = page.waitForEvent('filechooser');
await page.getByRole('button', { name: 'Открыть фото' }).click();
(await chooser).setFiles('public/test.png');

await page.locator('canvas').waitFor();
// Wait for the FIRST paint, not just the element: an empty canvas also
// exists before the rune effect has drawn the loaded photo.
await page.waitForFunction(() => {
  const c = document.querySelector('canvas');
  if (!c) return false;
  const d = c.getContext('2d').getImageData(Math.round(c.width / 2), Math.round(c.height / 2), 1, 1).data;
  return d[0] + d[1] + d[2] > 0;
});
const sample = () =>
  page.evaluate(() => {
    const c = document.querySelector('canvas');
    const ctx = c.getContext('2d');
    // 5 points along the middle row: red→yellow→green→cyan→blue zones
    return [0.1, 0.3, 0.5, 0.7, 0.9].map((fx) =>
      Array.from(ctx.getImageData(Math.round(c.width * fx), Math.round(c.height / 2), 1, 1).data.slice(0, 3)),
    );
  });
const before = await sample();

await page.getByRole('button', { name: 'Ektar 100' }).click(); // sync path incl. the curve pass
await page.waitForTimeout(300); // let the rune effect redraw the canvas
const after = await sample();

mkdirSync('artifacts', { recursive: true });

const deltas = before.map((b, i) => b.map((v, ch) => Math.abs(v - after[i][ch])));
const maxDelta = Math.max(...deltas.flat());
console.log(
  'pixels  before → after (max channel delta ' + maxDelta + '):\n' +
    before.map((b, i) => `  x${i}: [${b}] → [${after[i]}]`).join('\n'),
);

if (maxDelta === 0) {
  console.error('FAIL: ektar did not change canvas pixels');
  process.exitCode = 1;
}

// VGA preset proves the async 2D stage end-to-end: downscale must change
// the display canvas width to exactly 640 (noise + jpeg then run on it)
await page.getByRole('button', { name: 'Телефон 2003' }).click();
await page.waitForFunction(() => {
  const c = document.querySelector('canvas');
  return c !== null && c.width === 640;
}, { timeout: 5000 });
console.log('vga ok: canvas is 640px wide (downscale+noise+jpeg pipeline ran)');

// Screenshots of the looks for human eyeballing
for (const [label, file] of [
  ['Twin Peaks', 'look-twin-peaks.png'],
  ['Polaroid SX-70', 'look-polaroid-sx70.png'],
  ['Телефон 2003', 'look-vga-phone.png'],
  ['Portra 160', 'look-portra-160.png'],
  ['Ektar 100', 'look-ektar-100.png'],
]) {
  await page.getByRole('button', { name: label }).click();
  if (label === 'Телефон 2003') {
    // async 2D stage (jpeg round-trip) — wait for its visible effect, not a timer
    await page.waitForFunction(
      () => document.querySelector('canvas')?.width === 640,
      { timeout: 5000 },
    );
  }
  await page.waitForTimeout(300); // engine-only looks finish in a microtask

  // Orientation guard: the fixture is a lightness ramp (bright top, dark
  // bottom). A preset must never flip that — the vignette GL pass once did.
  const bands = await page.evaluate(() => {
    const c = document.querySelector('canvas');
    const ctx = c.getContext('2d');
    const h = Math.max(1, Math.round(c.height * 0.03));
    const avg = (y) => {
      const d = ctx.getImageData(0, y, c.width, h).data;
      let sum = 0;
      for (let i = 0; i < d.length; i += 4) sum += d[i] + d[i + 1] + d[i + 2];
      return sum / (d.length / 4) / 3;
    };
    return { top: avg(0), bottom: avg(c.height - h) };
  });
  console.log(`${label}: top ${bands.top.toFixed(1)} / bottom ${bands.bottom.toFixed(1)} brightness`);
  if (bands.top <= bands.bottom) {
    console.error(`FAIL: ${label} flipped the image vertically (top must stay brighter)`);
    process.exitCode = 1;
  }

  const box = await page.locator('canvas').boundingBox();
  if (box === null) throw new Error('canvas vanished before screenshot');
  await page.screenshot({ path: `artifacts/${file}`, clip: box });
}

// Zoomed SX-70 corner for the chromatic-aberration check (R/B fringing
// must be visible at the photo's edge, not in the center).
{
  await page.getByRole('button', { name: 'Polaroid SX-70' }).click();
  await page.waitForTimeout(400);
  const box = await page.locator('canvas').boundingBox();
  if (box === null) throw new Error('canvas vanished before corner shot');
  const s = 220;
  await page.screenshot({
    path: 'artifacts/sx70-corner.png',
    clip: { x: box.x + box.width - s, y: box.y, width: s, height: s },
  });
}

// CA guard: the hue-sweep fixture is too smooth to show fringing, so prove
// the ca pass geometry on synthetic hard edges. Two vertical white bars on
// black through ONLY the ca op: near the right edge the radial offset is
// horizontal (across the bar) → red/blue fringes; through the exact center
// it is vertical (along the bar) → only sub-pixel leakage. The guard fails
// if the pass loses its radial growth or its direction.
{
  const ca = await page.evaluate(async () => {
    const { renderOps } = await import('/millennium/src/render/engine.ts');
    const W = 800, H = 600;
    const c = document.createElement('canvas');
    c.width = W; c.height = H;
    const x = c.getContext('2d');
    x.fillStyle = '#000'; x.fillRect(0, 0, W, H);
    x.strokeStyle = '#fff'; x.lineWidth = 24;
    x.beginPath(); x.moveTo(700, 100); x.lineTo(700, 300); x.stroke(); // edge bar
    x.beginPath(); x.moveTo(400, 100); x.lineTo(400, 300); x.stroke(); // center bar
    const bitmap = await createImageBitmap(c);
    const out = await renderOps(bitmap, [{ type: 'ca', amount: 0.5 }]);
    const t = document.createElement('canvas');
    t.width = out.width; t.height = out.height;
    t.getContext('2d').drawImage(out, 0, 0);
    const ctx = t.getContext('2d');
    const maxRB = (cx) => {
      let m = 0;
      for (let px = cx - 45; px <= cx + 45; px++) {
        const d = ctx.getImageData(px, 200, 1, 1).data;
        m = Math.max(m, Math.abs(d[0] - d[2]));
      }
      return m;
    };
    return { edge: Math.round(maxRB(700)), center: Math.round(maxRB(400)), dataUrl: t.toDataURL('image/png') };
  });
  console.log(`ca guard: edge |R-B| ${ca.edge}, center |R-B| ${ca.center}`);
  if (ca.edge < 150 || ca.center > 80) {
    console.error('FAIL: ca pass lost its radial R/B split (edge must fringe, center must stay clean)');
    process.exitCode = 1;
  }
  const { writeFileSync } = await import('node:fs');
  writeFileSync('artifacts/ca-stripes.png', Buffer.from(ca.dataUrl.split(',')[1], 'base64'));
}

if (errors.length > 0) {
  console.error('CONSOLE ERRORS:\n' + errors.join('\n'));
  process.exitCode = 1;
} else {
  console.log('smoke ok: photo loaded, ektar applied, canvas rendered, console clean');
}

// Layout guard: photo loaded must not create horizontal scroll, and the
// canvas must stay inside the viewport — on desktop AND phone widths.
// (Once broke: one grid row for two editor children pushed the stage into
// an implicit row, canvas' natural 1200px width ripped the page open.)
for (const [name, viewport] of [
  ['desktop', { width: 1100, height: 800 }],
  ['phone', { width: 390, height: 844 }],
]) {
  const page2 = await browser.newPage({ viewport });
  await page2.goto(URL, { waitUntil: 'networkidle' });
  const chooser2 = page2.waitForEvent('filechooser');
  await page2.getByRole('button', { name: 'Открыть фото' }).click();
  (await chooser2).setFiles('public/test.png');
  await page2.waitForFunction(() => {
    const c = document.querySelector('canvas');
    if (!c) return false;
    const d = c.getContext('2d').getImageData(c.width / 2 | 0, c.height / 2 | 0, 1, 1).data;
    return d[0] + d[1] + d[2] > 0;
  });
  const layout = await page2.evaluate(() => {
    const de = document.documentElement;
    const c = document.querySelector('canvas');
    const r = c.getBoundingClientRect();
    return {
      scrollW: de.scrollWidth,
      innerW: window.innerWidth,
      canvasRight: Math.round(r.right),
      canvasBottom: Math.round(r.bottom),
    };
  });
  const ok = layout.scrollW <= layout.innerW + 1 && layout.canvasRight <= layout.innerW + 1;
  console.log(
    `layout ${name}: scrollW ${layout.scrollW}/${layout.innerW}, canvas right ${layout.canvasRight}, bottom ${layout.canvasBottom}`,
  );
  if (!ok) {
    console.error(`FAIL: ${name} layout — horizontal overflow with photo loaded`);
    process.exitCode = 1;
  }
  await page2.close();
}

await browser.close();
