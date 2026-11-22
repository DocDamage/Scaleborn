import assert from 'node:assert/strict';
import { mkdir } from 'node:fs/promises';
import { chromium } from 'playwright';

const BASE = process.env.SCALEBORN_URL ?? 'http://127.0.0.1:5173';
const browser = await chromium.launch({
  headless: true,
  args: [
    '--enable-webgl', '--ignore-gpu-blocklist', '--enable-unsafe-swiftshader',
    '--use-gl=angle', '--use-angle=swiftshader', '--disable-dev-shm-usage',
  ],
});
const errors = [];
try {
  const page = await browser.newPage({
    viewport: { width: 1280, height: 720 }, deviceScaleFactor: 1,
  });
  page.on('pageerror', (error) => errors.push('page: ' + error.message));
  page.on('console', (message) => {
    if (message.type() === 'error') errors.push('console: ' + message.text());
  });
  let ready = false;
  for (let i = 0; i < 12 && !ready; i++) {
    try {
      const response = await page.goto(BASE + '/?start=combat&qa=1&quality=low', {
        waitUntil: 'domcontentloaded', timeout: 12000,
      });
      ready = response?.status() === 200;
    } catch {
      await page.waitForTimeout(500);
    }
  }
  assert.ok(ready, 'Combat QA: Vite server unreachable');
  await page.locator('#start').click();
  await page.locator('#welcome').waitFor({ state: 'hidden' });
  await page.waitForFunction(
    () => typeof window.__scalebornQaCombatSnapshot === 'function',
    null, { timeout: 30000 },
  );
  const snapshot = () => page.evaluate(() => window.__scalebornQaCombatSnapshot());
  const alive = (s) => s.hounds.reduce((sum, h) => sum + h.hp, 0);
  const first = await snapshot();
  assert.equal(first.hounds.length, 3);
  assert.equal(first.fireSequence, 0);
  assert.equal(first.hp, 100);
  await mkdir('artifacts', { recursive: true });
  const hasWebGL = await page.locator('#game').evaluate((canvas) =>
    Boolean(canvas.getContext('webgl2')),
  );
  assert.ok(hasWebGL, 'Combat scene requires a real WebGL2 canvas');
  await page.screenshot({ path: 'artifacts/combat-gloam-encounter.png', timeout: 120000 });

  // R is the actual mapped keyboard action. QA observes outcomes read-only.
  await page.keyboard.press('r');
  await page.waitForFunction(() =>
    window.__scalebornQaCombatSnapshot()?.fireSequence === 1,
  null, { timeout: 40000 });
  const dragon = await snapshot();
  assert.ok(dragon.ember < first.ember, 'Fire must consume real Ember');
  assert.ok(alive(dragon) < alive(first), 'Dragon fire must hit an enemy ahead');
  await page.screenshot({ path: 'artifacts/combat-dragon-fire.png', timeout: 120000 });

  // Staging changes player placement only; rider attack uses regular R input.
  await page.evaluate(() => window.__scalebornQaStageCombat('rider'));
  await page.keyboard.press('r');
  await page.waitForFunction(() =>
    window.__scalebornQaCombatSnapshot()?.sigilSequence === 1,
  null, { timeout: 40000 });
  const rider = await snapshot();
  assert.ok(rider.focus < first.focus, 'Rider sigil must consume independent Focus');
  assert.ok(alive(rider) < alive(dragon), 'Rider sigil must damage the actual threat');
  await page.screenshot({ path: 'artifacts/combat-rider-sigil.png', timeout: 120000 });

  await page.evaluate(() => window.__scalebornQaStageCombat('bond'));
  await page.keyboard.press('x');
  await page.waitForFunction(() =>
    window.__scalebornQaCombatSnapshot()?.bondSequence === 1,
  null, { timeout: 40000 });
  const bond = await snapshot();
  assert.ok(bond.ember < dragon.ember, 'Bond surge must use dragon Ember');
  assert.ok(bond.focus < rider.focus, 'Bond surge must use rider Focus');
  assert.ok(alive(bond) < alive(rider), 'Bond surge must strike a nearby enemy');
  await page.screenshot({ path: 'artifacts/combat-bond-surge.png', timeout: 120000 });

  // Advance the *same* combat and movement simulations, not a mock attack.
  await page.evaluate(() => {
    window.__scalebornQaStageCombat('melee');
    window.__scalebornQaAdvanceCombat(180);
  });
  const melee = await snapshot();
  assert.ok(melee.hp < first.hp || melee.respawns > 0,
    'Real AI must close, telegraph and hit a nearby grounded player');
  assert.deepEqual(errors, [], 'Combat browser console/WebGL reported errors');
  console.log('PASS: real WebGL2 Gloam encounter, keyboard fire/sigil/bond, hostility and recovery.');
} finally {
  await browser.close();
}
