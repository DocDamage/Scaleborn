import assert from 'node:assert/strict';
import { mkdir } from 'node:fs/promises';
import { chromium } from 'playwright';

async function main() {
  const browser = await chromium.launch({
    headless: true,
    args: [
      '--enable-webgl',
      '--ignore-gpu-blocklist',
      '--enable-unsafe-swiftshader',
      '--use-gl=angle',
      '--use-angle=swiftshader',
      '--disable-dev-shm-usage',
    ],
  });
  const errors = [];
  try {
    const page = await browser.newPage({ viewport: { width: 1280, height: 720 }, deviceScaleFactor: 1 });
    page.on('pageerror', (error) => {
      const message = 'page: ' + error.message;
      errors.push(message);
      console.error('BROWSER PAGE ERROR:', message);
    });
    page.on('console', (message) => {
      if (message.type() === 'error') {
        errors.push('console: ' + message.text());
        console.error('BROWSER CONSOLE ERROR:', message.text());
      }
    });
    const url = process.env.SCALEBORN_URL ?? 'http://127.0.0.1:5173';
    // SwiftShader CPU rendering must not be mistaken for a dedicated GPU.
    const lowUrl = url + '?start=lake&quality=low&qa=1';
    let connected = false;
    for (let attempt = 0; attempt < 12; attempt++) {
      try {
        const response = await page.goto(lowUrl, { waitUntil: 'networkidle', timeout: 10000 });
        assert.equal(response?.status(), 200);
        connected = true;
        break;
      } catch {
        await page.waitForTimeout(500);
      }
    }
    assert.ok(connected, 'Vite dev server was not reachable');
    await page.locator('#start').click();
    await page.locator('#welcome').waitFor({ state: 'hidden' });
    await page.evaluate(() => {
      if (typeof window.__scalebornQaAdvance === 'function') {
        window.__scalebornQaAdvance(1);
      }
    });
    await page.waitForFunction(() => Number(document.querySelector('#speed')?.textContent) > 0,
      null, { timeout: 30000 });
    await page.waitForTimeout(800);
    await mkdir('artifacts', { recursive: true });
    await page.screenshot({ timeout: 120000, path: 'artifacts/azure-coast-chase.png' });
    const formName = page.locator('#form-name');
    await formName.waitFor({ state: 'attached' });
    assert.match(await formName.textContent() ?? '', /RIDEABLE/);
    // Size selection at altitude must either switch safely or explain obstruction.
    await page.keyboard.press('3');
    await page.waitForFunction(() => {
      const text = document.querySelector('#form-name')?.textContent;
      const notice = document.querySelector('#action-toast')?.textContent;
      return text?.includes('GIANT') || notice?.includes('Climb higher');
    }, null, { timeout: 20000 });
    await page.screenshot({ timeout: 120000, path: 'artifacts/azure-coast-giant.png' });
    await page.keyboard.press('2');
    await page.waitForFunction(() => document.querySelector('#form-name')?.textContent === 'RIDEABLE', null, { timeout: 20000 });
    await page.keyboard.press('1');
    await page.waitForFunction(() =>
      document.querySelector('#action-toast')?.textContent?.includes('Land first'),
      null, { timeout: 20000 });
    assert.match(await page.locator('#form-name').textContent() ?? '', /RIDEABLE/);
    const initialCamera = await page.locator('#camera-name').textContent();
    await page.keyboard.press('v');
    await page.waitForFunction(
      (before) => document.querySelector('#camera-name')?.textContent !== before,
      initialCamera, { timeout: 20000 },
    );
    await page.waitForTimeout(1600);
    const hasWebGL = await page.locator('#game').evaluate((canvas) =>
      Boolean(canvas.getContext('webgl2')),
    );
    assert.ok(hasWebGL, 'No WebGL2 context on game canvas');
    await page.screenshot({ timeout: 120000, path: 'artifacts/azure-coast-smoke.png' });
    // Extended QA uses real player keyboard controls (1/2/Tab/G), not hidden menu buttons. SwiftShader sometimes
    // stalls RAF, so dev-only bounded simulation steps refresh HUD deterministically.
    // Exercise a complete animated landing/size change/takeoff in a deterministic meadow.
    const meadowResponse = await page.goto(url + '?start=meadow&qa=1&quality=low', { waitUntil: 'networkidle' });
    assert.equal(meadowResponse?.status(), 200);
    await page.locator('#start').click();
    await page.evaluate(() => {
      if (typeof window.__scalebornQaLand !== 'function') throw new Error('Dev landing hook missing');
      window.__scalebornQaLand();
    });
    await page.waitForFunction(() => document.querySelector('#mode-name')?.textContent === 'LANDING', null, { timeout: 15000 });
    await page.evaluate(() => {
      if (typeof window.__scalebornQaAdvance !== 'function') throw new Error('Dev QA step hook missing');
      window.__scalebornQaAdvance(100);
    });
    await page.waitForFunction(() => document.querySelector('#mode-name')?.textContent === 'ON LAND', null, { timeout: 12000 });
    await page.keyboard.press('1');
    await page.evaluate(() => window.__scalebornQaAdvance(1));
    await page.waitForFunction(() => document.querySelector('#form-name')?.textContent === 'SMALL COMPANION', null, { timeout: 12000 });
    await page.keyboard.press('g');
    await page.waitForFunction(() => document.querySelector('#tidegate-status')?.textContent === '1 / 2 RUNES', null, { timeout: 12000 });
    await page.keyboard.press('Tab');
    await page.evaluate(() => window.__scalebornQaAdvance(1));
    await page.waitForFunction(() => document.querySelector('#focus-name')?.textContent === 'RIDER', null, { timeout: 12000 });
    await page.evaluate(() => {
      if (typeof window.__scalebornQaStageRiderRune !== 'function') throw new Error('Tidegate QA hook missing');
      window.__scalebornQaStageRiderRune();
    });
    await page.keyboard.press('g');
    await page.waitForFunction(() => document.querySelector('#tidegate-status')?.textContent === 'TIDEBOUND SIGIL AWAKENED', null, { timeout: 12000 });
    await page.screenshot({ timeout: 120000, path: 'artifacts/azure-coast-small-meadow.png' });
    await page.keyboard.press('Tab');
    await page.evaluate(() => window.__scalebornQaAdvance(1));
    await page.waitForFunction(() => document.querySelector('#focus-name')?.textContent === 'DRAGON', null, { timeout: 12000 });
    await page.keyboard.press('2');
    await page.evaluate(() => window.__scalebornQaAdvance(1));
    await page.waitForFunction(() => document.querySelector('#form-name')?.textContent === 'RIDEABLE', null, { timeout: 12000 });
    await page.evaluate(() => {
      if (typeof window.__scalebornQaLaunch !== 'function') throw new Error('Dev takeoff hook missing');
      window.__scalebornQaLaunch();
    });
    await page.waitForFunction(() => document.querySelector('#mode-name')?.textContent === 'TAKING OFF', null, { timeout: 15000 });
    await page.evaluate(() => {
      if (typeof window.__scalebornQaAdvance !== 'function') throw new Error('Dev QA step hook missing');
      window.__scalebornQaAdvance(90);
    });
    await page.waitForFunction(() => document.querySelector('#mode-name')?.textContent === 'IN FLIGHT', null, { timeout: 12000 });

    // Water uses the same scene and simulation; fixed-step QA avoids slow SwiftShader timing.
    await page.evaluate(() => {
      if (typeof window.__scalebornQaWater !== 'function') throw new Error('Water QA hook unavailable');
      window.__scalebornQaWater();
      window.__scalebornQaAdvance(85);
    });
    await page.waitForFunction(() => document.querySelector('#mode-name')?.textContent === 'SWIMMING', null, { timeout: 12000 });
    await page.evaluate(() => {
      window.__scalebornQaDive();
      window.__scalebornQaAdvance(85);
    });
    await page.waitForFunction(() => document.querySelector('#mode-name')?.textContent === 'DIVING', null, { timeout: 12000 });
    assert.ok(Number(await page.locator('#altitude').textContent()) >= 1, 'Water dive must report depth');
    await page.evaluate(() => {
      window.__scalebornQaDive();
      window.__scalebornQaAdvance(100);
    });
    await page.waitForFunction(() => document.querySelector('#mode-name')?.textContent === 'SWIMMING', null, { timeout: 12000 });

    // The real G interaction must collect the underwater heart, then allow
    // a separate rider-only attunement back at the already solved Tidegate.
    await page.evaluate(() => {
      if (typeof window.__scalebornQaStageShrine !== 'function') throw new Error('Shrine QA hook missing');
      window.__scalebornQaStageShrine();
    });
    await page.waitForFunction(() => document.querySelector('#mode-name')?.textContent === 'DIVING', null, { timeout: 12000 });
    await page.screenshot({ timeout: 120000, path: 'artifacts/azure-coast-tidal-echo-before.png' });
    await page.keyboard.press('g');
    await page.waitForFunction(() => document.querySelector('#echo-stage')?.textContent === 'ECHO COLLECTED', null, { timeout: 12000 });
    await page.screenshot({ timeout: 120000, path: 'artifacts/azure-coast-tidal-echo.png' });
    await page.evaluate(() => {
      if (typeof window.__scalebornQaStageEchoReturn !== 'function') throw new Error('Echo return QA hook missing');
      window.__scalebornQaStageEchoReturn();
    });
    await page.keyboard.press('g');
    await page.waitForFunction(() => document.querySelector('#echo-stage')?.textContent === 'COMPLETE', null, { timeout: 12000 });
    const stored = await page.evaluate(() => {
      const raw = window.localStorage.getItem('scaleborn.azure-progress.v1');
      return raw ? JSON.parse(raw) : null;
    });
    assert.equal(stored?.tidegateSolved, true);
    assert.equal(stored?.echo?.collected, true);
    assert.equal(stored?.echo?.attuned, true);
    // A real rendered visual acceptance screenshot, not a generated concept image.
    await page.evaluate(() => {
      if (typeof window.__scalebornQaLake !== 'function') throw new Error('Lake QA hook missing');
      window.__scalebornQaLake();
    });
    await page.waitForTimeout(850);
    await page.screenshot({ path: 'artifacts/mirrorfall-lake-visual.png', timeout: 120000 });
    assert.deepEqual(errors, [], 'Browser reported runtime or shader errors');
    console.log('PASS: WebGL2, dragon/rider controls, ocean diving, quest progress and Mirrorfall Lake visual screenshot.');
  } finally {
    await browser.close();
  }
}
main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
