import assert from 'node:assert/strict';
import { mkdir } from 'node:fs/promises';
import { chromium } from 'playwright';

/** Fast, isolated real-WebGL capture; never use AI-generated imagery as QA.
 * --hardware uses the *high* game materials and refuses software fallback.
 * The default software-WebGL test remains unchanged for reproducible CI.
 */
async function main() {
  const hardware = process.argv.includes('--hardware');
  const screenshotFile = (path) => hardware
    ? path.replace(/-browser\\.png$/, '-high-browser.png') : path;
  const browser = await chromium.launch({
    headless: true,
    args: hardware ? [
      '--enable-webgl', '--ignore-gpu-blocklist',
      '--disable-software-rasterizer', '--disable-dev-shm-usage',
    ] : [
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
      + '?start=lake&quality=' + (hardware ? 'high' : 'low') + '&qa=1';
    const response = await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 30000 });
    assert.equal(response?.status(), 200, 'The game must load successfully');
    await page.locator('#start').click();
    const adapter = await page.locator('#game').evaluate((canvas) => {
      const gl = canvas.getContext('webgl2');
      if (!gl) throw new Error('No WebGL2 context in actual game');
      const debug = gl.getExtension('WEBGL_debug_renderer_info');
      return String(debug
        ? gl.getParameter(debug.UNMASKED_RENDERER_WEBGL)
        : gl.getParameter(gl.RENDERER));
    });
    if (hardware && /swiftshader|llvmpipe|software/i.test(adapter)) {
      throw new Error('Hardware review refused software renderer: ' + adapter);
    }
    console.log('Visual capture mode:', hardware ? 'HIGH / HARDWARE' : 'LOW / SOFTWARE',
      'WebGL renderer:', adapter);
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
    await page.screenshot({ path: screenshotFile('artifacts/mirrorfall-actual-browser.png'), timeout: 120000 });
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
    await page.screenshot({ path: screenshotFile('artifacts/mirrorfall-shoreline-browser.png'), timeout: 120000 });
    // Real ground-level forest acceptance: camera walks beside one seeded oak.
    // The render must contain genuine instanced trees and fern cover.
    await page.evaluate(() => {
      if (typeof window.__scalebornQaForest !== 'function') {
        throw new Error('Ground-level forest camera hook missing');
      }
      window.__scalebornQaForest();
    });
    await page.waitForFunction(() =>
      document.querySelector('#focus-name')?.textContent === 'RIDER',
      null, { timeout: 15000 });
    await page.waitForTimeout(500);
    await page.screenshot({
      path: screenshotFile('artifacts/mirrorfall-forest-browser.png'), timeout: 120000,
    });
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
      path: screenshotFile('artifacts/mirrorfall-underwater-browser.png'), timeout: 120000,
    });
    // Second dive camera actually looks across a planted, terrain-following
    // freshwater shelf; the deep midwater view is kept separately.
    await page.evaluate(() => {
      if (typeof window.__scalebornQaLakebed !== 'function') {
        throw new Error('Shallow lakebed QA hook missing');
      }
      window.__scalebornQaLakebed();
    });
    await page.waitForTimeout(500);
    await page.screenshot({
      path: screenshotFile('artifacts/mirrorfall-lakebed-browser.png'), timeout: 120000,
    });
    if (hardware) {
      // Production-quality review includes the actual physical source of
      // Mirrorfall's waterfall and its underwater impact, not just a lake
      // panorama. These remain real WebGL pixels, not concept art.
      await page.evaluate(() => {
        if (typeof window.__scalebornQaHeadwaters !== 'function') {
          throw new Error('Headwater view unavailable');
        }
        window.__scalebornQaHeadwaters();
      });
      await page.waitForTimeout(600);
      await page.screenshot({
        path: screenshotFile('artifacts/mirrorfall-headwaters-browser.png'),
        timeout: 120000,
      });
      await page.evaluate(() => {
        if (typeof window.__scalebornQaImpactDive !== 'function') {
          throw new Error('Underwater impact view unavailable');
        }
        window.__scalebornQaImpactDive();
      });
      await page.waitForTimeout(600);
      await page.screenshot({
        path: screenshotFile('artifacts/mirrorfall-impact-underwater-browser.png'),
        timeout: 120000,
      });
    }
    assert.deepEqual(errors, [], 'WebGL/JavaScript renderer errors');
    console.log('PASS: actual Mirrorfall WebGL views captured in',
      hardware ? 'hardware HIGH' : 'software LOW', 'mode.');
  } finally {
    await browser.close();
  }
}
main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
