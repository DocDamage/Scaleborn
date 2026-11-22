import * as THREE from 'three';
import { describe, expect, it } from 'vitest';
import { GRAND_LAKE, lakeBoundaryScale } from '../src/world/highlandLake';
import { lakeSwashAt } from '../src/world/shoreSwash';
import { lakeShoreWaveOffsetAt, waterWaveOffsetAt } from '../src/world/waterWaves';
import { MIRRORFALL_IMPACT, plungeWaveAt,
  plungeWaveUnmaskedAt } from '../src/world/waterDynamics';
import { makeTerrainMaterial } from '../src/world/materials';
import { updateTerrainPigmentTime } from '../src/world/terrainPigment';

const bank = (radial:number):{x:number;z:number} => {
  const theta=Math.PI/2;
  const shore=lakeBoundaryScale(theta)*radial;
  return {
    x:GRAND_LAKE.x+Math.cos(theta)*GRAND_LAKE.radiusX*shore,
    z:GRAND_LAKE.z+Math.sin(theta)*GRAND_LAKE.radiusZ*shore,
  };
};

describe('wave-coupled Mirrorfall terrain swash',()=>{
  it('animates wet-bank contact without changing the collision shoreline',()=>{
    const {x,z}=bank(1.01), y=GRAND_LAKE.surfaceY+.7;
    const values=Array.from({length:22},(_,i)=>lakeSwashAt(x,y,z,i*.5));
    expect(Math.min(...values)).toBeGreaterThanOrEqual(0);
    expect(Math.max(...values)).toBeLessThanOrEqual(1);
    expect(Math.max(...values)-Math.min(...values)).toBeGreaterThan(.25);
    // No beach wetness through the deep lake, far onto a dry hillside,
    // or halfway up the waterfall escarpment.
    const submerged=bank(.94), far=bank(1.2);
    expect(lakeSwashAt(submerged.x,y,submerged.z,1)).toBe(0);
    expect(lakeSwashAt(far.x,y,far.z,1)).toBe(0);
    expect(lakeSwashAt(x,GRAND_LAKE.surfaceY+30,z,1)).toBe(0);
    expect(lakeSwashAt(Number.NaN,y,z,1)).toBe(0);
    expect(lakeSwashAt(x,y,z,Number.POSITIVE_INFINITY)).toBe(0);
  });

  it('uses identical wind and plunge phases across waterline samples',()=>{
    const shore=bank(1.005), water=bank(.97);
    const t=3.43;
    expect(lakeShoreWaveOffsetAt(water.x,water.z,t))
      .toBeCloseTo(waterWaveOffsetAt(water.x,water.z,t),7);
    expect(Number.isFinite(lakeShoreWaveOffsetAt(shore.x,shore.z,t))).toBe(true);
    // Outside water, no physical lake wave is applied to swimmer controls.
    expect(plungeWaveAt(MIRRORFALL_IMPACT.x+35,MIRRORFALL_IMPACT.z,.5)).toBe(0);
    expect(Math.abs(plungeWaveUnmaskedAt(
      MIRRORFALL_IMPACT.x+35,MIRRORFALL_IMPACT.z,.5))).toBeGreaterThan(.01);
  });

  it('streams a stable time uniform into both actual terrain shader presets',()=>{
    for(const quality of ['low','high'] as const){
      const material=makeTerrainMaterial(quality);
      try{
        const shader={
          uniforms:{} as Record<string,unknown>,
          vertexShader:'#include <common>\n#include <worldpos_vertex>',
          fragmentShader:[
            '#include <common>',
            '#include <color_fragment>',
            '#include <map_fragment>',
            '#include <normal_fragment_maps>',
            '#include <roughnessmap_fragment>',
          ].join('\n'),
        };
        material.onBeforeCompile(shader as never,{} as never);
        const time=shader.uniforms.uScPigTime as {value:number};
        expect(time.value).toBe(0);
        updateTerrainPigmentTime(material,2.75);
        expect(time.value).toBe(2.75);
        updateTerrainPigmentTime(material,Number.NaN);
        expect(time.value).toBe(2.75);
        expect(shader.fragmentShader).toContain('float scPigLakeWave');
        expect(shader.fragmentShader).toContain('float scPigSwash');
        expect(shader.fragmentShader).toContain('scPigCreekWet');
        expect(shader.fragmentShader).toContain('roughnessFactor=mix(roughnessFactor,0.29');
        expect(material).toBeInstanceOf(THREE.MeshStandardMaterial);
      }finally{material.dispose();}
    }
  });
});
