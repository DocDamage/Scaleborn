import assert from 'node:assert/strict';
import { mkdir, writeFile } from 'node:fs/promises';
import { chromium } from 'playwright';

/**
 * Repeatable high-quality, unthrottled browser profile. This deliberately
 * does NOT use the QA hook (which caps the renderer at 8 FPS).
 * Frame deltas are presentation timing, not GPU timer-query results.
 *
 * Run with Vite already started:
 *   npm run benchmark:gpu
 * To use an interactive hardware WebGL window:
 *   SCALEBORN_BENCH_HEADFUL=1 npm run benchmark:gpu
 */
const output='artifacts/scaleborn-high-hardware-profile.json';
const capture='artifacts/scaleborn-high-hardware-profile.png';
const durationSeconds=Number(process.env.SCALEBORN_BENCH_SECONDS ?? '12');
assert.ok(Number.isFinite(durationSeconds)
  && durationSeconds>=5 && durationSeconds<=60,
'Benchmark duration must be between 5 and 60 seconds');

function percentile(sorted, p) {
  if (!sorted.length) return 0;
  const i=Math.max(0,Math.min(sorted.length-1,
    Math.ceil(sorted.length*p)-1));
  return sorted[i];
}

async function main() {
  const errors=[];
  const browser=await chromium.launch({
    headless:process.env.SCALEBORN_BENCH_HEADFUL!=='1',
    args:[
      '--enable-webgl','--ignore-gpu-blocklist',
      '--disable-software-rasterizer','--disable-dev-shm-usage',
    ],
  });
  try {
    const page=await browser.newPage({
      viewport:{width:1600,height:900},deviceScaleFactor:1,
    });
    page.on('pageerror',error=>errors.push('page: '+error.message));
    page.on('console',message=>{
      if(message.type()==='error')errors.push('console: '+message.text());
    });
    const url=new globalThis.URL(process.env.SCALEBORN_URL??'http://127.0.0.1:5173');
    url.searchParams.set('start','lake');
    url.searchParams.set('quality','high');
    url.searchParams.delete('qa');
    const response=await page.goto(url.toString(),{
      waitUntil:'domcontentloaded',timeout:30000,
    });
    assert.equal(response?.status(),200,'Start the local Vite game server first');
    await page.locator('#start').click();

    const adapter=await page.locator('#game').evaluate(canvas=>{
      const gl=canvas.getContext('webgl2');
      if (!gl)throw new Error('High-mode benchmark requires WebGL2');
      const debug=gl.getExtension('WEBGL_debug_renderer_info');
      return {
        vendor:debug ? String(gl.getParameter(debug.UNMASKED_VENDOR_WEBGL)) : '',
        renderer:debug ? String(gl.getParameter(debug.UNMASKED_RENDERER_WEBGL)) : '',
        genericRenderer:String(gl.getParameter(gl.RENDERER)),
      };
    });
    if (!adapter.renderer || /swiftshader|llvmpipe|softpipe|software|basic render/i
      .test(adapter.renderer)) {
      throw new Error('Cannot verify real hardware WebGL rendering: '
        +JSON.stringify(adapter));
    }

    // Shader warm-up is separate from presentation samples. Ordinary frame
    // scheduling, adaptive quality and live world movement remain enabled.
    await page.waitForTimeout(2000);
    const samples=await page.evaluate(({durationMs})=>new Promise(resolve=>{
      const frames=[];
      const started=globalThis.performance.now();
      let last=0;
      const tick=now=>{
        if(last)frames.push(Math.max(0,now-last));
        last=now;
        if(now-started>=durationMs){
          resolve({frames,durationMs:now-started});
        }else {
          globalThis.requestAnimationFrame(tick);
        }
      };
      globalThis.requestAnimationFrame(tick);
    }),{durationMs:durationSeconds*1000});

    const frameTimes=samples.frames.filter(t=>Number.isFinite(t)&&t>0)
      .sort((a,b)=>a-b);
    assert.ok(frameTimes.length>=10,
      'Not enough live gameplay frames for a meaningful measurement');
    const sum=frameTimes.reduce((a,b)=>a+b,0);
    const fps=frameTimes.length/(sum/1000);

    await page.keyboard.press('F3');
    await page.waitForTimeout(900);
    const diagnostics=await page.locator('#diagnostics').textContent()??'';
    const number=(name)=>{
      const escaped=name.replace(/[.*+?^${}()|[\]\\]/g,'\\$&');
      const match=diagnostics.match(new RegExp('(?:^|\\n)'+escaped+'\\s+([\\d.]+)'));
      return match?Number(match[1]):null;
    };
    assert.deepEqual(errors,[],'Gameplay or shader reported runtime errors');

    await mkdir('artifacts',{recursive:true});
    await page.keyboard.press('F3');
    await page.screenshot({path:capture,timeout:120000});
    const report={
      project:'Scaleborn / Azure Coast',
      evidence:'Real unthrottled browser RAF presentation times (not direct GPU timings)',
      quality:'high',
      qaRender:false,
      adapter,
      viewport:{width:1600,height:900,devicePixelRatio:1},
      sampleCount:frameTimes.length,
      sampleSeconds:Math.round(samples.durationMs/1000*100)/100,
      averageFps:Math.round(fps*10)/10,
      medianFrameMs:Math.round(percentile(frameTimes,.50)*100)/100,
      p95FrameMs:Math.round(percentile(frameTimes,.95)*100)/100,
      worstFrameMs:Math.round(frameTimes[frameTimes.length-1]*100)/100,
      drawCalls:number('DRAWS'),
      triangles:number('TRIANGLES'),
      internalPixelRatio:number('INTERNAL DPR'),
      browserErrors:errors,
      screenshot:capture,
    };
    await writeFile(output,JSON.stringify(report,null,2)+'\n');
    console.log(JSON.stringify(report,null,2));
    console.log('This profile is evidence, not automatic visual approval.');
  }finally{
    await browser.close();
  }
}
main().catch(error=>{console.error(error);process.exitCode=1;});
