import * as THREE from 'three';
import { describe, expect, it } from 'vitest';
import { lakeContains, lakeRadius, GRAND_LAKE } from '../src/world/highlandLake';
import { makeLakeShoreBreakGeometry } from '../src/world/lakeShoreBreak';
import { LakeShoreFoam, makeFoamShader } from '../src/world/waterSurface';

describe('discontinuous Mirrorfall shoreline swash',()=>{
  it('builds stable indexed, bank-contained ribbons with real gaps',()=>{
    const a=makeLakeShoreBreakGeometry(),b=makeLakeShoreBreakGeometry();
    try{
      const sectors=a.userData.patchSectors as number[];
      const positions=a.getAttribute('position'),uv=a.getAttribute('uv');
      const steps=a.userData.stepsPerPatch as number;
      expect(a.userData.sectorCount).toBe(240);
      expect(sectors.length).toBeGreaterThan(100);
      expect(sectors.length).toBeLessThan(210);
      expect(new Set(sectors).size).toBe(sectors.length);
      expect(sectors.some((sector,i)=>i>0&&sector-sectors[i-1]!>1)).toBe(true);
      expect(steps).toBe(6);
      expect(positions.count).toBe(sectors.length*(steps+1)*2);
      expect(uv.count).toBe(positions.count);
      expect(a.index?.count).toBe(sectors.length*steps*6);
      expect(Array.from(a.index!.array)).toEqual(Array.from(b.index!.array));
      for(let j=0;j<positions.count;j++){
        expect(Number.isFinite(positions.getX(j))).toBe(true);
        expect(Number.isFinite(positions.getZ(j))).toBe(true);
        expect(lakeContains(positions.getX(j),positions.getZ(j))).toBe(true);
        expect(positions.getY(j)).toBeCloseTo(GRAND_LAKE.surfaceY+.14,4);
      }
      for(let j=0;j<Math.min(positions.count,150);j++){
        expect(positions.getX(j)).toBeCloseTo(b.getAttribute('position').getX(j),4);
      }
    }finally{a.dispose();b.dispose();}
  });

  it('tapers each ribbon inwards and preserves fading UVs',()=>{
    const geometry=makeLakeShoreBreakGeometry();
    try{
      const positions=geometry.getAttribute('position');
      const uv=geometry.getAttribute('uv');
      const steps=geometry.userData.stepsPerPatch as number;
      let tapered=0;
      for(let patch=0;patch<(geometry.userData.patchSectors as number[]).length;patch++){
        const first=patch*(steps+1)*2;
        const half=first+Math.floor(steps/2)*2;
        const width=(index:number)=>lakeRadius(
          positions.getX(index),positions.getZ(index))
          -lakeRadius(positions.getX(index+1),positions.getZ(index+1));
        if(width(half)>width(first)*3)tapered++;
        expect(uv.getX(first)).toBeCloseTo(0,7);
        expect(uv.getX(first+steps*2)).toBeCloseTo(1,7);
        expect(uv.getY(first)).toBe(0);
        expect(uv.getY(first+1)).toBe(1);
      }
      expect(tapered).toBeGreaterThan(100);
    }finally{geometry.dispose();}
  });

  it('uses real animated shoreline shader with fading patch ends and a single draw',()=>{
    const shore=new LakeShoreFoam(),ocean=makeFoamShader();
    try {
      const material=shore.mesh.material as THREE.ShaderMaterial;
      expect(shore.mesh.geometry.index?.count).toBeGreaterThan(3000);
      expect(shore.mesh.name).toBe('water.azure.lake-shore-foam');
      expect(material.uniforms.uLakeStrip?.value).toBe(1);
      expect(ocean.uniforms.uLakeStrip?.value).toBe(0);
      expect(material.fragmentShader).toContain('float shorePatches=');
      expect(material.fragmentShader).toContain('uLakeStrip');
      expect(material.fragmentShader).toContain('vWorld.x*.085');
      expect(material.fragmentShader).toContain('cameraPosition.y < vWorld.y-.35');
      expect(material.vertexShader).toContain('world.y += .53*sin(w1)');
      shore.update(8.25);
      expect(material.uniforms.uTime?.value).toBe(8.25);
      expect(shore.mesh.children.length).toBe(0);
    }finally{shore.dispose();ocean.dispose();}
  });
});
