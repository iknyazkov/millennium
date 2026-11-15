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
await page.getByText('Выбери фото — оно не покинет это устройство.').waitFor();

// Feed the file through the real file chooser, as a user would
const chooser = page.waitForEvent('filechooser');
await page.getByText('Открыть фото').click();
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

await page.getByRole('button', { name: 'Kodachrome' }).click();
await page.waitForTimeout(300); // let the rune effect redraw the canvas
const after = await sample();

mkdirSync('artifacts', { recursive: true });
await page.screenshot({ path: 'artifacts/skeleton-kodachrome.png' });

const deltas = before.map((b, i) => b.map((v, ch) => Math.abs(v - after[i][ch])));
const maxDelta = Math.max(...deltas.flat());
console.log(
  'pixels  before → after (max channel delta ' + maxDelta + '):\n' +
    before.map((b, i) => `  x${i}: [${b}] → [${after[i]}]`).join('\n'),
);

if (maxDelta === 0) {
  console.error('FAIL: kodachrome did not change canvas pixels');
  process.exitCode = 1;
}

if (errors.length > 0) {
  console.error('CONSOLE ERRORS:\n' + errors.join('\n'));
  process.exitCode = 1;
} else {
  console.log('smoke ok: photo loaded, kodachrome applied, canvas rendered, console clean');
}
await browser.close();
