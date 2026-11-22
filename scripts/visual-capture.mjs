import assert from 'node:assert/strict';
import { mkdir } from 'node:fs/promises';
import { chromium } from 'playwright';

/** Fast, isolated real-WebGL capture; never use AI-generated imagery as QA. */
async function main() {
  const browser = await chromium.launch({
    headless: true,
    args: [
      '--enable-webgl', '--ignore-gpu-blocklist',
      '--enable-unsafe-swiftshader', '--use-gl=angle',
      '--use-angle=swiftshader', '--disable-dev-shm-usage',
    ],
  });
  try {
    const errors = [];
    const page = await browser.newPage({
      viewport: { width: 1280, height: 720 }, deviceScaleFactor: 1,
    });
    page.on('pageerror', (e) => errors.push(e.message));
    page.on('console', (m) => {
      if (m.type() === 'error') errors.push(m.text());
    });
    const url = (process.env.SCALEBORN_URL ?? 'http://127.0.0.1:5173')
      + '?start=lake&quality=low';
    const response = await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 30000 });
    assert.equal(response?.status(), 200, 'The game must load successfully');
    await page.locator('#start').click();
    await page.waitForFunction(() => Number(document.querySelector('#speed')?.textContent) >= 0,
      null, { timeout: 30000 });
    await mkdir('artifacts', { recursive: true });
    await page.screenshot({ path: 'artifacts/mirrorfall-actual-browser.png', timeout: 120000 });
    assert.deepEqual(errors, [], 'WebGL/JavaScript renderer errors');
    console.log('PASS: Mirrorfall actual browser screenshot rendered without console errors.');
  } finally {
    await browser.close();
  }
}
main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
