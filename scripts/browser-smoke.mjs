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
    page.on('pageerror', (error) => errors.push('page: ' + error.message));
    page.on('console', (message) => {
      if (message.type() === 'error') errors.push('console: ' + message.text());
    });
    const url = process.env.SCALEBORN_URL ?? 'http://127.0.0.1:5173';
    let connected = false;
    for (let attempt = 0; attempt < 12; attempt++) {
      try {
        const response = await page.goto(url, { waitUntil: 'networkidle', timeout: 6000 });
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
    await page.waitForFunction(() => Number(document.querySelector('#speed')?.textContent) > 0, null, { timeout: 15000 });
    await page.waitForTimeout(800);
    await mkdir('artifacts', { recursive: true });
    await page.screenshot({ path: 'artifacts/azure-coast-chase.png' });
    const formName = page.locator('#form-name');
    await formName.waitFor({ state: 'visible' });
    assert.match(await formName.textContent() ?? '', /RIDEABLE/);
    // Size selection at altitude must either switch safely or explain obstruction.
    await page.keyboard.press('3');
    await page.waitForFunction(() => {
      const text = document.querySelector('#form-name')?.textContent;
      const notice = document.querySelector('#action-toast')?.textContent;
      return text?.includes('GIANT') || notice?.includes('Climb higher');
    }, null, { timeout: 6000 });
    await page.screenshot({ path: 'artifacts/azure-coast-giant.png' });
    await page.keyboard.press('2');
    await page.waitForFunction(() => document.querySelector('#form-name')?.textContent === 'RIDEABLE', null, { timeout: 6000 });
    await page.keyboard.press('1');
    await page.waitForFunction(() =>
      document.querySelector('#action-toast')?.textContent?.includes('Land first'),
      null, { timeout: 6000 });
    assert.match(await page.locator('#form-name').textContent() ?? '', /RIDEABLE/);
    const initialCamera = await page.locator('#camera-name').textContent();
    await page.keyboard.press('v');
    await page.waitForFunction(
      (before) => document.querySelector('#camera-name')?.textContent !== before,
      initialCamera, { timeout: 6000 },
    );
    await page.waitForTimeout(1600);
    const hasWebGL = await page.locator('#game').evaluate((canvas) =>
      Boolean(canvas.getContext('webgl2')),
    );
    assert.ok(hasWebGL, 'No WebGL2 context on game canvas');
    await page.screenshot({ path: 'artifacts/azure-coast-smoke.png' });
    assert.deepEqual(errors, [], 'Browser reported runtime or shader errors');
    console.log('PASS: WebGL2 rendered, HUD and size controls active, midair dismount blocked, camera switched, screenshots captured.');
  } finally {
    await browser.close();
  }
}
main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
