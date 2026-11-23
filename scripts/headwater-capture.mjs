import assert from 'node:assert/strict';
import { mkdir } from 'node:fs/promises';
import { chromium } from 'playwright';
import { captureQaScreenshot } from './qa-screenshot.mjs';

/**
 * Optional, real-WebGL headwater capture. Separate from the five-frame
 * regression suite so regular PR commits do not add costly SwiftShader work.
 */
async function main(){
  const browser=await chromium.launch({
    headless:true,
    args:['--enable-webgl','--ignore-gpu-blocklist',
      '--enable-unsafe-swiftshader','--use-gl=angle',
      '--use-angle=swiftshader','--disable-dev-shm-usage'],
  });
  try{
    const errors=[];
    const page=await browser.newPage({
      viewport:{width:1280,height:720},deviceScaleFactor:1,
    });
    page.on('pageerror',e=>errors.push(e.message));
    page.on('console',m=>{
      if(m.type()==='error')errors.push(m.text());
    });
    const url=(process.env.SCALEBORN_URL??'http://127.0.0.1:5173')
      +'?start=lake&quality=low&qa=1';
    const response=await page.goto(url,{
      waitUntil:'domcontentloaded',timeout:30000,
    });
    assert.equal(response?.status(),200,'The actual game must load');
    await page.locator('#start').click();
    await page.evaluate(()=>{
      if(typeof window.__scalebornQaHeadwaters!=='function')
        throw new Error('Headwater QA staging hook missing');
      window.__scalebornQaHeadwaters();
    });
    await page.waitForFunction(()=>
      document.querySelector('#focus-name')?.textContent==='RIDER',
      null,{timeout:30000});
    await page.waitForTimeout(650);
    await mkdir('artifacts',{recursive:true});
    await captureQaScreenshot(page, {
      path:'artifacts/mirrorfall-headwaters-browser.png',timeout:120000,
    });
    // A separate on-demand dive showcases the waterfall's actual
    // submerged plume, not just the fog at the empty lake center.
    await page.evaluate(()=>{
      if(typeof window.__scalebornQaImpactDive!=='function')
        throw new Error('Underwater impact QA staging hook missing');
      window.__scalebornQaImpactDive();
    });
    await page.waitForFunction(()=>
      document.querySelector('#mode-name')?.textContent==='DIVING',
      null,{timeout:30000});
    await page.waitForTimeout(650);
    await captureQaScreenshot(page, {
      path:'artifacts/mirrorfall-impact-underwater-browser.png',timeout:120000,
    });
    assert.deepEqual(errors,[],'No WebGL/JavaScript errors');
    console.log('PASS: real in-game headwater and underwater impact screenshots captured');
  }finally{await browser.close();}
}
main().catch(error=>{console.error(error);process.exitCode=1;});
