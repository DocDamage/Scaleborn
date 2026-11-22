import assert from 'node:assert/strict';
import { mkdir } from 'node:fs/promises';
import { chromium } from 'playwright';
import { captureQaScreenshot } from './qa-screenshot.mjs';

const browser=await chromium.launch({headless:true,args:[
  '--enable-webgl','--ignore-gpu-blocklist','--enable-unsafe-swiftshader',
  '--use-gl=angle','--use-angle=swiftshader','--disable-dev-shm-usage',
]});
const errors=[];
try {
  const page=await browser.newPage({
    viewport:{width:1280,height:720},deviceScaleFactor:1,
  });
  page.on('pageerror',error=>errors.push('page: '+error.message));
  page.on('console',message=>{
    if(message.type()==='error') errors.push('console: '+message.text());
  });
  const origin=process.env.SCALEBORN_URL??'http://127.0.0.1:5173';
  const response=await page.goto(origin+'?start=meadow&qa=1&quality=low',{
    waitUntil:'domcontentloaded',timeout:30000,
  });
  assert.equal(response?.status(),200);
  await page.locator('#start').click();
  await page.locator('#welcome').waitFor({state:'hidden'});
  await mkdir('artifacts',{recursive:true});

  await page.evaluate(()=>{
    window.__scalebornQaLand();
    window.__scalebornQaAdvance(100);
  });
  await page.waitForFunction(()=>document.querySelector('#mode-name')?.textContent==='ON LAND');
  await page.evaluate(() => window.__scalebornQaCharacterPortrait('rideable'));
  await page.waitForTimeout(500);
  await captureQaScreenshot(page, {path:'artifacts/characters-onyx-rideable.png',timeout:120000});

  await page.keyboard.press('1');
  await page.evaluate(()=>window.__scalebornQaAdvance(8));
  await page.waitForFunction(()=>
    document.querySelector('#form-name')?.textContent==='SMALL COMPANION');
  await page.evaluate(() => window.__scalebornQaCharacterPortrait('small'));
  await page.waitForTimeout(400);
  await captureQaScreenshot(page, {path:'artifacts/characters-onyx-small.png',timeout:120000});

  await page.evaluate(() => window.__scalebornQaCharacterPortrait('rider'));
  await page.waitForFunction(()=>
    document.querySelector('#focus-name')?.textContent==='RIDER');
  await page.waitForTimeout(400);
  await captureQaScreenshot(page, {path:'artifacts/characters-hybrid-hero.png',timeout:120000});

  await page.evaluate(()=>window.__scalebornQaLake());
  await page.keyboard.press('3');
  await page.evaluate(()=>window.__scalebornQaAdvance(10));
  await page.waitForFunction(()=>
    document.querySelector('#form-name')?.textContent==='GIANT');
  await page.evaluate(() => window.__scalebornQaCharacterPortrait('giant'));
  await page.waitForTimeout(550);
  await captureQaScreenshot(page, {path:'artifacts/characters-onyx-giant.png',timeout:120000});

  assert.deepEqual(errors,[],'Browser/shader errors during real character rendering');
  console.log('PASS: actual skinned wing, three form changes and hybrid rider rendered.');
} finally {
  await browser.close();
}
