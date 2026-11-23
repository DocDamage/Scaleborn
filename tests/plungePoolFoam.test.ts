import * as THREE from 'three';
import { describe, expect, it } from 'vitest';
import { GRAND_LAKE, lakeContains } from '../src/world/highlandLake';
import { MIRRORFALL_IMPACT } from '../src/world/waterDynamics';
import { MirrorfallCascade, waterfallSpraySurfaceY } from '../src/world/mirrorfallCascade';
import { PlungePoolFoam, makePlungeFoamTrails } from '../src/world/plungePoolFoam';
import { makeSprayStreakGeometry, makeSprayStreakTexture } from '../src/world/sprayStreak';

describe('Mirrorfall impact foam and spray rendering',()=>{
  it('breaks plunge foam into lake-confined surface patches instead of fixed torus outlines',()=>{
    const low=new PlungePoolFoam('low'), high=new PlungePoolFoam('high');
    try{
      const g=low.mesh.geometry;
      const p=g.getAttribute('position'),uv=g.getAttribute('uv'),bands=g.getAttribute('aRing');
      expect(p.count).toBeGreaterThan(1000);
      expect(high.mesh.geometry.getAttribute('position').count).toBeGreaterThan(p.count);
      expect(uv.count).toBe(p.count);
      expect(bands.count).toBe(p.count);
      expect(g.index?.count).toBeGreaterThan(1200);
      for(let i=0;i<g.index!.count;i+=13) {
        const j=g.index!.getX(i);
        expect(lakeContains(p.getX(j),p.getZ(j))).toBe(true);
        expect(p.getY(j)).toBeCloseTo(GRAND_LAKE.surfaceY+.20,4);
      }
      const shader=low.mesh.material;
      expect(shader.transparent).toBe(true);
      expect(shader.depthWrite).toBe(false);
      expect(shader.fog).toBe(true);
      expect(shader.uniforms.fogColor?.value).toBeInstanceOf(THREE.Color);
      expect(shader.uniforms.fogDensity?.value).toBeDefined();
      expect(shader.vertexShader).toContain('#include <fog_vertex>');
      expect(shader.fragmentShader).toContain('#include <fog_fragment>');
      expect(shader.uniforms.uImpactWorld?.value).toEqual(
        new THREE.Vector2(MIRRORFALL_IMPACT.x,MIRRORFALL_IMPACT.z));
      expect(shader.vertexShader).toContain('plungeD');
      expect(shader.vertexShader).toContain('aRing');
      expect(shader.fragmentShader).toContain('breakUp');
      expect(shader.fragmentShader).toContain('flowQ');
      expect(shader.fragmentShader).toContain('float tips=');
      expect(shader.fragmentShader).toContain('cameraPosition.y < vWorld.y');
      low.update(12.5);
      expect(shader.uniforms.uTime?.value).toBe(12.5);
    }finally{low.dispose();high.dispose();}
  });


  it('replaces concentric ring geometry with open, outward-curving impact-current streaks',()=>{
    const low=makePlungeFoamTrails('low');
    const high=makePlungeFoamTrails('high');
    try {
      expect(low.userData.trailCount).toBe(30);
      expect(high.userData.trailCount).toBe(48);
      expect(low.userData.stepsPerTrail).toBe(18);
      const p=low.getAttribute('position');
      const steps=low.userData.stepsPerTrail as number;
      let bent=0;
      const trailCount=low.userData.trailCount as number;
      for(let i=0;i<trailCount;i++){
        const first=(i*(steps+1))*3+1;
        const middle=(i*(steps+1)+Math.floor(steps/2))*3+1;
        const last=(i*(steps+1)+steps)*3+1;
        const distance=(vertex:number):number=>Math.hypot(
          p.getX(vertex)-MIRRORFALL_IMPACT.x,
          p.getZ(vertex)-MIRRORFALL_IMPACT.z,
        );
        expect(distance(last)).toBeGreaterThan(distance(first)+7);
        const heading=(vertex:number):number=>Math.atan2(
          p.getZ(vertex)-MIRRORFALL_IMPACT.z,
          p.getX(vertex)-MIRRORFALL_IMPACT.x,
        );
        const angleChange=Math.atan2(
          Math.sin(heading(last)-heading(middle)),
          Math.cos(heading(last)-heading(middle)),
        );
        if(Math.abs(angleChange)>.015)bent++;
      }
      expect(bent).toBeGreaterThan(8);
      expect(high.getAttribute('position').count).toBeGreaterThan(p.count);
      expect(low.index!.count).toBeGreaterThan(1200);
      for(let i=0;i<low.index!.count;i++){
        const vertex=low.index!.getX(i);
        expect(lakeContains(p.getX(vertex),p.getZ(vertex))).toBe(true);
      }
    }finally{low.dispose();high.dispose();}
  });

  it('uses soft alpha-tapered crossed velocity streaks instead of polyhedral spray beads',()=>{
    const geo=makeSprayStreakGeometry();
    const tex=makeSprayStreakTexture();
    try{
      const uv=geo.getAttribute('uv'),p=geo.getAttribute('position');
      expect(p.count).toBe(12);
      expect(uv.count).toBe(12);
      const data=tex.image.data as Uint8Array;
      const alpha=(x:number,y:number):number=>data[(y*64+x)*4+3] ?? 0;
      expect(alpha(31,31)).toBeGreaterThan(140);
      expect(alpha(1,1)).toBe(0);
      expect(tex.colorSpace).toBe(THREE.SRGBColorSpace);
      expect(()=>makeSprayStreakTexture(12)).toThrow();
    }finally{geo.dispose();tex.dispose();}
  });

  it('keeps the waterfall a batched, gravity-driven animation with stable disposal',()=>{
    const low=new MirrorfallCascade('low');
    const high=new MirrorfallCascade('high');
    try{
      const droplets=low.group.getObjectByName('water.azure.mirrorfall-ballistic-spray');
      expect(droplets).toBeInstanceOf(THREE.InstancedMesh);
      const lowMesh=droplets as THREE.InstancedMesh;
      const hiMesh=high.group.getObjectByName('water.azure.mirrorfall-ballistic-spray') as THREE.InstancedMesh;
      expect(lowMesh.count).toBeLessThan(hiMesh.count);
      expect(lowMesh.geometry.getAttribute('position').count).toBe(12);
      expect((lowMesh.material as THREE.MeshBasicMaterial).map).toBeInstanceOf(THREE.DataTexture);
      const pool=low.group.getObjectByName('water.azure.mirrorfall-impact-foam');
      expect(pool).toBeInstanceOf(THREE.Mesh);
      expect(low.group.children.some(o=>o instanceof THREE.Mesh && o.geometry instanceof THREE.TorusGeometry)).toBe(false);
      low.update(1);low.update(1.05);
      const m=new THREE.Matrix4(),rotation=new THREE.Quaternion(),scale=new THREE.Vector3(),center=new THREE.Vector3();
      lowMesh.getMatrixAt(0,m);
      m.decompose(center,rotation,scale);
      expect(Number.isFinite(center.x)).toBe(true);
      expect(center.y).toBeGreaterThanOrEqual(
        waterfallSpraySurfaceY(center.x,center.z,1.05)+.10);
      expect(scale.y).toBeGreaterThan(scale.x);
      expect((pool as THREE.Mesh<THREE.BufferGeometry,THREE.ShaderMaterial>)
        .material.uniforms.uTime?.value).toBe(1.05);
    }finally{low.dispose();high.dispose();}
  });
});
