import * as THREE from 'three';
import { describe, expect, it } from 'vitest';
import { GRAND_LAKE } from '../src/world/highlandLake';
import { MIRRORFALL_IMPACT } from '../src/world/waterDynamics';
import { sampleWaterWaves } from '../src/world/waterWaves';
import { MirrorfallCascade, waterfallSpraySurfaceY } from '../src/world/mirrorfallCascade';

describe('animated cascade veils and wave-matched ballistic splash', () => {
  it('shears and perforates the falling water while keeping the crest anchored', () => {
    const cascade=new MirrorfallCascade('low');
    try {
      const curtains=cascade.group.children.filter(o=>
        o.name==='water.azure.mirrorfall-curtain') as THREE.Mesh[];
      expect(curtains).toHaveLength(3);
      const shader=curtains[0]!.material as THREE.ShaderMaterial;
      expect(shader.vertexShader).toContain('float fallMix=smoothstep(.08,.92,uv.y)');
      expect(shader.vertexShader).toContain('sheetFlutter.z +=');
      expect(shader.vertexShader).toContain('sheetFlutter.x +=');
      expect(shader.fragmentShader).toContain('flowAccel');
      expect(shader.fragmentShader).toContain('float porosity=');
      expect(shader.fragmentShader).toContain('float macroSplit=');
      expect(shader.fragmentShader).toContain('jetIsolation');
      expect(shader.fragmentShader).toContain('baseAlpha*=mix(1.0');
      expect(shader.fog).toBe(true);
      cascade.update(2.45);
      expect(shader.uniforms.uTime?.value).toBe(2.45);
      for(const curtain of curtains) {
        const uv=curtain.geometry.getAttribute('uv');
        expect(uv.getY(0)).toBe(0);
        expect(uv.getY(uv.count-1)).toBe(1);
        const position=curtain.geometry.getAttribute('position');
        const crestSamples=Array.from({length:25},(_,i)=>position.getY(i));
        expect(Math.max(...crestSamples)-Math.min(...crestSamples))
          .toBeGreaterThan(.60);
        expect(crestSamples.every(Number.isFinite)).toBe(true);
        expect(curtain.material).toBe(shader);
      }
    } finally {cascade.dispose();}
  });

  it('collides with the dynamic freshwater surface but retires spray at the rim', () => {
    const x=MIRRORFALL_IMPACT.x,z=MIRRORFALL_IMPACT.z;
    for(const time of [0,1.25,4.6]) {
      expect(waterfallSpraySurfaceY(x,z,time)).toBeCloseTo(
        sampleWaterWaves(x,z,time).surfaceY,6);
    }
    expect(waterfallSpraySurfaceY(2000,2000,2)).toBe(GRAND_LAKE.surfaceY);
    expect(waterfallSpraySurfaceY(NaN,z,2)).toBe(GRAND_LAKE.surfaceY);
    expect(waterfallSpraySurfaceY(x,z,Infinity)).toBe(GRAND_LAKE.surfaceY);
  });

  it('keeps visible droplets above instantaneous water crests after update', () => {
    const cascade=new MirrorfallCascade('low');
    try {
      cascade.update(1.75);
      cascade.update(1.80);
      const spray=cascade.group.getObjectByName(
        'water.azure.mirrorfall-ballistic-spray') as THREE.InstancedMesh;
      expect(spray).toBeInstanceOf(THREE.InstancedMesh);
      const matrix=new THREE.Matrix4(), p=new THREE.Vector3();
      for(let i=0;i<spray.count;i++){
        spray.getMatrixAt(i,matrix);
        p.setFromMatrixPosition(matrix);
        expect(p.y).toBeGreaterThanOrEqual(
          waterfallSpraySurfaceY(p.x,p.z,1.80)+.10);
      }
    } finally {cascade.dispose();}
  });
});
