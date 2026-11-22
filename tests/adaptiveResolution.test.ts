import { describe, expect, it } from 'vitest';
import { AdaptiveResolution } from '../src/app/adaptiveResolution';

describe('hysteretic render quality preserving game simulation',()=>{
  const newScaler=()=>new AdaptiveResolution({min:.56,max:1.4,starting:1.4});
  it('reduces pixel ratio only after sustained slow rendering',()=>{
    const scale=newScaler();
    expect(scale.recordFps(19)).toBeNull();
    expect(scale.recordFps(25)).toBeNull();
    expect(scale.recordFps(22)).toBe(1.3);
    expect(scale.pixelRatio).toBe(1.3);
  });
  it('never drops below supported ratio or oscillates on mixed samples',()=>{
    const scale=newScaler();
    for(let i=0;i<250;i++)scale.recordFps(15);
    expect(scale.pixelRatio).toBe(.56);
    for(let i=0;i<5;i++){
      scale.recordFps(70);
      scale.recordFps(19);
    }
    expect(scale.pixelRatio).toBe(.56);
  });
  it('can recover gradually when renderer consistently has headroom',()=>{
    const scale=newScaler();
    for(let i=0;i<11;i++)scale.recordFps(17);
    expect(scale.pixelRatio).toBeLessThan(1.4);
    for(let i=0;i<50;i++)scale.recordFps(70);
    expect(scale.pixelRatio).toBeGreaterThan(1.3);
    expect(scale.pixelRatio).toBeLessThanOrEqual(1.4);
  });
  it('validates bounds and ignores invalid FPS samples',()=>{
    expect(()=>new AdaptiveResolution({min:1.3,max:1,starting:1})).toThrow();
    const scale=newScaler();
    expect(scale.recordFps(NaN)).toBeNull();
    expect(scale.recordFps(0)).toBeNull();
    expect(scale.pixelRatio).toBe(1.4);
  });
});
