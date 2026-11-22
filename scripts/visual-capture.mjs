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
    page.on('pageerror', (e) => {
      errors.push(e.message);
      console.error('BROWSER PAGE ERROR:', e.message);
    });
    page.on('console', (m) => {
      if (m.type() === 'error') {
        errors.push(m.text());
        console.error('BROWSER CONSOLE ERROR:', m.text());
      }
    });
    const url = (process.env.SCALEBORN_URL ?? 'http://127.0.0.1:5173')
      + '?start=lake&quality=low&qa=1';
    const response = await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 30000 });
    assert.equal(response?.status(), 200, 'The game must load successfully');
    await page.locator('#start').click();
    // Software-WebGL may take several seconds to finish its first frame.
    // A development-only fixed step updates the real HUD deterministically;
    // the screenshots still exercise actual WebGL rendering and errors.
    await page.evaluate(() => {
      if (typeof window.__scalebornQaAdvance !== 'function') {
        throw new Error('Deterministic visual QA hook missing');
      }
      window.__scalebornQaAdvance(1);
    });
    await page.waitForFunction(() => Number(document.querySelector('#speed')?.textContent) >= 0,
      null, { timeout: 30000 });
    await mkdir('artifacts', { recursive: true });
    await page.screenshot({ path: 'artifacts/mirrorfall-actual-browser.png', timeout: 120000 });
    // Shoreline view exposes grass blades and procedural PBR detail.
    await page.evaluate(() => {
      if (typeof window.__scalebornQaShore !== 'function') {
        throw new Error('Shoreline camera hook missing');
      }
      window.__scalebornQaShore();
    });
    // QA-only software rendering is throttled to keep the main thread responsive.
    // Allow a fresh real WebGL frame after teleport before capturing the shore.
    await page.waitForTimeout(350);
    await page.screenshot({ path: 'artifacts/mirrorfall-shoreline-browser.png', timeout: 120000 });
    // The new depth-optics pass must render from an actual submerged camera.
    // This is a third real WebGL screenshot, not a generated concept image.
    await page.evaluate(() => {
      if (typeof window.__scalebornQaLakeDive !== 'function') {
        throw new Error('Freshwater dive camera hook missing');
      }
      window.__scalebornQaLakeDive();
    });
    await page.waitForFunction(() => document.querySelector('#mode-name')?.textContent === 'DIVING',
      null, { timeout: 15000 });
    await page.waitForTimeout(450);
    await page.screenshot({
      path: 'artifacts/mirrorfall-underwater-browser.png', timeout: 120000,
    });
    assert.deepEqual(errors, [], 'WebGL/JavaScript renderer errors');
    console.log('PASS: Mirrorfall aerial, shoreline and real underwater WebGL screenshots rendered without console errors.');
  } finally {
    await browser.close();
  }
}
main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
