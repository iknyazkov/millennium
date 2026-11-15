// PWA smoke: service worker registers, then the app survives offline reload.
// Run AFTER `npm run build` with `npm run preview` serving dist (port 4173).
import { chromium } from 'playwright';

const URL = process.env.SMOKE_URL ?? 'http://localhost:4173/';

const browser = await chromium.launch();
const page = await browser.newPage();
const errors = [];
page.on('console', (m) => {
  if (m.type() === 'error') errors.push(m.text());
});
page.on('pageerror', (e) => errors.push(String(e)));

await page.goto(URL, { waitUntil: 'networkidle' });

// Service worker actually registers and takes control
await page.evaluate(() => navigator.serviceWorker.ready);
const controlled = await page.evaluate(
  () => navigator.serviceWorker.controller !== null,
);

// Offline reload: the whole point of the PWA decision
await page.context().setOffline(true);
await page.reload({ waitUntil: 'domcontentloaded' });
const offlineOk = await page
  .getByText('Millennium')
  .first()
  .isVisible()
  .catch(() => false);
await page.context().setOffline(false);

if (!controlled) {
  console.error('FAIL: no service worker controller after ready');
  process.exitCode = 1;
} else if (!offlineOk) {
  console.error('FAIL: app did not render after offline reload');
  process.exitCode = 1;
} else if (errors.length > 0) {
  console.error('CONSOLE ERRORS:\n' + errors.join('\n'));
  process.exitCode = 1;
} else {
  console.log('pwa ok: sw controls page, app renders after offline reload, console clean');
}
await browser.close();
