import * as THREE from 'three';
import { describe, expect, it } from 'vitest';
import { MirrorfallHeadwaters, makeHeadwaterGeometry } from '../src/world/mirrorfallHeadwaters';
import { MIRRORFALL, GRAND_LAKE, headwaterProfileAt, headwaterContains } from '../src/world/highlandLake';

describe('actual visible creek feeding the Mirrorfall waterfall',()=>{
  it('stays inside the shared shallow river and meets the falling curtain crest',()=>{
    const low=makeHeadwaterGeometry('low');
    const high=makeHeadwaterGeometry('high');
    try{
      const p=low.getAttribute('position'),uv=low.getAttribute('uv');
      expect(low.index!.count).toBeGreaterThan(2500);
      expect(high.index!.count).toBeGreaterThan(low.index!.count);
      expect(uv.count).toBe(p.count);
      expect(low.getAttribute('normal').count).toBe(p.count);
      const firstX=p.getX(0),lastX=p.getX(p.count-1);
      expect(firstX).toBeCloseTo(MIRRORFALL.x-1,5);
      expect(lastX).toBeCloseTo(MIRRORFALL.x-1+132,5);
      for(let i=0;i<p.count;i+=29){
        const x=p.getX(i),z=p.getZ(i);
        const profile=headwaterProfileAt(x,z);
        expect(profile).not.toBeNull();
        expect(headwaterContains(x,z)).toBe(true);
        expect(p.getY(i)).toBeCloseTo(profile!.surfaceY+.055,3);
      }
    }finally{low.dispose();high.dispose();}
  });
  it('uses fog-safe, time-driven transparent stream material without replacing lake',()=>{
    const stream=new MirrorfallHeadwaters('low');
    try{
      const mat=stream.mesh.material;
      expect(mat.fog).toBe(true);
      expect(mat.transparent).toBe(true);
      expect(mat.depthWrite).toBe(false);
      expect(mat.uniforms.fogColor?.value).toBeInstanceOf(THREE.Color);
      expect(mat.vertexShader).toContain('uTime*2.35');
      expect(mat.fragmentShader).toContain('wetShore');
      expect(mat.fragmentShader).toContain('#include <fog_fragment>');
      stream.update(12.34);
      expect(mat.uniforms.uTime?.value).toBe(12.34);
      const x=GRAND_LAKE.x;
      expect(x).toBeLessThan(MIRRORFALL.x);
    }finally{stream.dispose();}
  });
});
