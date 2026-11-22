import * as THREE from 'three';
import { describe, expect, it } from 'vitest';
import { resolveCameraOcclusion } from '../src/app/cameraOcclusion';

describe('third-person camera collision and view preservation',()=>{
  const origin=new THREE.Vector3(0,3,0);
  const desired=new THREE.Vector3(-12,5,0);

  it('leaves an unobstructed line unchanged',()=>{
    const target=resolveCameraOcclusion(origin,desired,()=>0,[]);
    expect(target.toArray()).toEqual(desired.toArray());
    expect(target).not.toBe(desired);
  });

  it('pulls the camera in front of terrain blocking the chase view',()=>{
    const ridge=(x:number):number=>x<-3.0&&x>-5.5?9:0;
    const camera=resolveCameraOcclusion(
      origin,desired,(x)=>ridge(x),[],1.1);
    expect(camera.x).toBeGreaterThan(-3.05);
    expect(camera.x).toBeLessThan(0);
    expect(camera.y).toBeGreaterThan(2);
    expect(camera.distanceTo(origin)).toBeLessThan(desired.distanceTo(origin));
    expect(camera.y).toBeGreaterThanOrEqual(ridge(camera.x)+1.1);
  });

  it('also stops before tall building proxies and ignores distant structures',()=>{
    const blockers=[{x:-6,z:0,radius:1.4,top:19}];
    const hidden=resolveCameraOcclusion(origin,desired,()=>0,blockers);
    expect(hidden.x).toBeGreaterThan(-5);
    const clear=resolveCameraOcclusion(origin,desired,()=>0,[
      {x:20,z:20,radius:5,top:100},
    ]);
    expect(clear.toArray()).toEqual(desired.toArray());
  });

  it('returns finite near-camera fallback when focus overlaps a hillside',()=>{
    const a=new THREE.Vector3(0,1,0);
    const b=new THREE.Vector3(0,5,10);
    const result=resolveCameraOcclusion(a,b,()=>7,[]);
    expect(result.y).toBeGreaterThanOrEqual(8.15);
    expect(Number.isFinite(result.x)).toBe(true);
  });
});
