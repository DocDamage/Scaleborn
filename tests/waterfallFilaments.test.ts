import * as THREE from 'three';
import { describe, expect, it } from 'vitest';
import { createCascadeFilaments } from '../src/world/waterfallFilaments';
import { MirrorfallCascade } from '../src/world/mirrorfallCascade';
import { GRAND_LAKE, MIRRORFALL } from '../src/world/highlandLake';
import { MIRRORFALL_IMPACT } from '../src/world/waterDynamics';
import { waterfallCenterXAt } from '../src/world/waterfallTrajectory';

describe('layered, flow-advected waterfall rope geometry',()=>{
  it('batches crossed non-rectangular ribbons into one geometry per quality',()=>{
    const low=createCascadeFilaments('low');
    const high=createCascadeFilaments('high');
    try{
      expect(low.index!.count).toBeGreaterThan(3000);
      expect(high.index!.count).toBeGreaterThan(low.index!.count);
      const p=low.getAttribute('position'),uv=low.getAttribute('uv');
      expect(uv.count).toBe(p.count);
      expect(low.getAttribute('normal').count).toBe(p.count);
      for(let i=0;i<p.count;i+=157){
        expect(Number.isFinite(p.getX(i))).toBe(true);
        expect(Number.isFinite(p.getY(i))).toBe(true);
        expect(Number.isFinite(p.getZ(i))).toBe(true);
        expect(p.getY(i)).toBeGreaterThanOrEqual(GRAND_LAKE.surfaceY);
        expect(p.getY(i)).toBeLessThanOrEqual(MIRRORFALL.topY);
        expect(Math.abs(p.getZ(i)-MIRRORFALL.z)).toBeLessThan(MIRRORFALL.width*.7);
      }
      const x=Array.from({length:p.count},(_,i)=>p.getX(i));
      expect(Math.min(...x)).toBeLessThan(MIRRORFALL.x-60);
      expect(waterfallCenterXAt(.25)).toBeLessThan(MIRRORFALL.x-22);
      expect(Math.max(...x)).toBeGreaterThan(MIRRORFALL_IMPACT.x-4);
    }finally{low.dispose();high.dispose();}
  });

  it('reuses the existing fog-safe animated waterfall material',()=>{
    const fall=new MirrorfallCascade('low');
    try{
      const threads=fall.group.getObjectByName('water.azure.mirrorfall-filament-ropes')
        as THREE.Mesh<THREE.BufferGeometry,THREE.ShaderMaterial>;
      expect(threads).toBeInstanceOf(THREE.Mesh);
      const curtain=fall.group.getObjectByName('water.azure.mirrorfall-curtain')
        as THREE.Mesh;
      expect(threads.material).toBe(curtain.material);
      expect(threads.material.uniforms.fogDensity?.value).toBeDefined();
      expect(fall.group.children.filter(o=>o.name==='water.azure.mirrorfall-filament-ropes'))
        .toHaveLength(1);
      fall.update(7.4);
      expect(threads.material.uniforms.uTime?.value).toBe(7.4);
    }finally{fall.dispose();}
  });
});
