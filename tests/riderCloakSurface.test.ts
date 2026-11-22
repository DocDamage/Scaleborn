import * as THREE from 'three';
import { describe, expect, it } from 'vitest';
import { makeScalebornRider } from '../src/actors/rider/heroSculpt';
import { RiderCloakMotion } from '../src/actors/rider/cloakMotion';
import { DragonVisual } from '../src/actors/dragon/visual';
import { newFlightState } from '../src/actors/dragon/flight';

describe('actual game rider cloak painted drape', () => {
  it('has tiled PBR texture UVs, subtle pigment and non-flat sculpted cloth', () => {
    const rider=makeScalebornRider();
    const cloak=rider.getObjectByName('rider.travel-cloak') as THREE.Mesh<
      THREE.BufferGeometry, THREE.MeshStandardMaterial>;
    expect(cloak).toBeInstanceOf(THREE.Mesh);
    const g=cloak.geometry;
    const p=g.getAttribute('position'), uv=g.getAttribute('uv'), color=g.getAttribute('color');
    expect(p.count).toBe(15*17);
    expect(uv.count).toBe(p.count);
    expect(color.count).toBe(p.count);
    expect(cloak.material.vertexColors).toBe(true);
    expect(cloak.material.map).toBeInstanceOf(THREE.DataTexture);
    expect(cloak.material.normalMap).toBeInstanceOf(THREE.DataTexture);
    expect(cloak.material.roughnessMap).toBeInstanceOf(THREE.DataTexture);
    expect(uv.getX(16)).toBeCloseTo(2,5);
    expect(uv.getY(14*17)).toBeCloseTo(2.6,5);
    for(let j=0;j<=16;j++) {
      expect(p.getY(j)).toBeCloseTo(1.12,5);
      expect(p.getZ(j)).toBeCloseTo(.142,5);
    }
    const hemY=Array.from({length:17},(_,j)=>p.getY(14*17+j));
    const hemZ=Array.from({length:17},(_,j)=>p.getZ(14*17+j));
    expect(Math.max(...hemY)-Math.min(...hemY)).toBeGreaterThan(.02);
    expect(Math.max(...hemZ)-Math.min(...hemZ)).toBeGreaterThan(.035);
    expect(g.boundingSphere!.radius).toBeGreaterThan(1);
    for(let i=0;i<p.count;i++) {
      expect([p.getX(i),p.getY(i),p.getZ(i),
        uv.getX(i),uv.getY(i),color.getX(i),color.getY(i),color.getZ(i)]
        .every(Number.isFinite)).toBe(true);
    }
    g.dispose();
  });

  it('retains pinned shoulders, buffer identity and bounded asymmetric banking', () => {
    const rider=makeScalebornRider();
    const mesh=rider.getObjectByName('rider.travel-cloak') as THREE.Mesh;
    const motion=new RiderCloakMotion(mesh);
    const pos=mesh.geometry.getAttribute('position') as THREE.BufferAttribute;
    const raw=pos.array as Float32Array;
    const rest=raw.slice();
    motion.update(3.2,28,.65);
    const positive=raw.slice();
    expect(pos.array).toBe(raw);
    for(let i=0;i<17*3;i++)expect(raw[i]).toBeCloseTo(rest[i]!,7);
    motion.update(3.2,28,-.65);
    const negative=raw.slice();
    const hem=(14*17+8)*3;
    expect(positive[hem]).toBeGreaterThan(negative[hem]!+.07);
    expect(positive[hem+2]).toBeCloseTo(negative[hem+2]!,5);
    motion.update(Number.NaN,Number.POSITIVE_INFINITY,Number.NaN);
    expect(Array.from(raw).every(Number.isFinite)).toBe(true);
    expect(mesh.geometry.getAttribute('normal').count).toBe(pos.count);
    mesh.geometry.dispose();
  });

  it('uses actual dragon mounted banking without resizing the child rider', () => {
    const model=new DragonVisual();
    const state=newFlightState();
    try {
      state.form='rideable'; state.mode='air'; state.time=1.75; state.speed=32; state.roll=.65;
      model.update(state);
      const cloak=model.rider.getObjectByName('rider.travel-cloak') as THREE.Mesh;
      const p=cloak.geometry.getAttribute('position') as THREE.BufferAttribute;
      const right=(p.array as Float32Array).slice();
      state.roll=-.65;
      model.update(state);
      const left=p.array as Float32Array;
      expect(right[(14*17+8)*3]).toBeGreaterThan(left[(14*17+8)*3]!+.07);
      expect(model.rider.scale.x).toBe(1);
      expect(model.rider.getObjectByName('rider.leftArm')).toBeInstanceOf(THREE.Group);
    }finally{model.dispose();}
  });
});
