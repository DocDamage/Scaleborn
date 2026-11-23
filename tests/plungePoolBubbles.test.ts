import * as THREE from 'three';
import { describe, expect, it } from 'vitest';
import { PlungePoolBubbles, makePlungeBubbleGeometry } from '../src/world/plungePoolBubbles';
import { MIRRORFALL_IMPACT } from '../src/world/waterDynamics';
import { GRAND_LAKE, lakeContains } from '../src/world/highlandLake';
import { heightAt } from '../src/world/terrain';
import { underwaterOpticsAt } from '../src/world/underwaterOptics';

describe('Mirrorfall submerged impact-bubble plume',()=>{
  it('roots every bubble inside the freshwater bathymetry, not dry cliffs',()=>{
    const low=makePlungeBubbleGeometry('low');
    const high=makePlungeBubbleGeometry('high');
    try{
      const pos=low.getAttribute('position'),bed=low.getAttribute('aBedY');
      expect(pos.count).toBeGreaterThan(130);
      expect(high.getAttribute('position').count).toBeGreaterThan(pos.count);
      expect(bed.count).toBe(pos.count);
      expect(low.getAttribute('aRise').count).toBe(pos.count);
      expect(low.getAttribute('aBubbleSize').count).toBe(pos.count);
      for(let i=0;i<pos.count;i+=9){
        const x=pos.getX(i),z=pos.getZ(i),y=pos.getY(i);
        const floor=bed.getX(i);
        expect(lakeContains(x,z)).toBe(true);
        expect(floor).toBeCloseTo(heightAt(x,z),3);
        expect(y).toBeGreaterThan(floor);
        expect(y).toBeLessThan(GRAND_LAKE.surfaceY);
        expect(Math.hypot(x-MIRRORFALL_IMPACT.x,z-MIRRORFALL_IMPACT.z))
          .toBeLessThan(28);
      }
    }finally{low.dispose();high.dispose();}
  });

  it('uses one underwater-only transparent point pass with fog and bounds',()=>{
    const scene=new THREE.Scene(),bubbles=new PlungePoolBubbles(scene,'low');
    try{
      expect(bubbles.points).toBeInstanceOf(THREE.Points);
      expect(bubbles.points.visible).toBe(false);
      expect(scene.children).toHaveLength(1);
      const mat=bubbles.points.material;
      expect(mat.fog).toBe(true);
      expect(mat.depthWrite).toBe(false);
      expect(mat.uniforms.fogColor?.value).toBeInstanceOf(THREE.Color);
      expect(mat.fragmentShader).toContain('rim');
      const close=new THREE.Vector3(MIRRORFALL_IMPACT.x,
        GRAND_LAKE.surfaceY-7,MIRRORFALL_IMPACT.z);
      const optics=underwaterOpticsAt(close.x,close.y,close.z,true);
      bubbles.update(12,close,optics);
      expect(bubbles.points.visible).toBe(true);
      expect(mat.uniforms.uTime?.value).toBe(12);
      expect(mat.uniforms.uImmersion?.value).toBe(1);
      bubbles.update(13,new THREE.Vector3(1900,-20,1900),
        underwaterOpticsAt(1900,-20,1900,true));
      expect(bubbles.points.visible).toBe(false);
      bubbles.update(14,new THREE.Vector3(close.x,100,close.z),
        underwaterOpticsAt(close.x,100,close.z,true));
      expect(bubbles.points.visible).toBe(false);
    }finally{bubbles.dispose();}
    expect(scene.children).toHaveLength(0);
  });
});
