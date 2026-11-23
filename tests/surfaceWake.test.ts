import * as THREE from 'three';
import { describe, expect, it } from 'vitest';
import { SurfaceWake } from '../src/world/surfaceWake';
import { makeWakeCrestGeometry, makeWakeCrestTexture } from '../src/world/wakeCrest';
import { waterSurfaceAt } from '../src/world/highlandLake';
import { waterWaveOffsetAt } from '../src/world/waterWaves';
import { newFlightState } from '../src/actors/dragon/flight';
import { beginTraversal } from '../src/actors/dragon/traversalTransition';
import { dragonSurfaceY } from '../src/world/waterPhysics';
import { GRAND_LAKE } from '../src/world/highlandLake';
describe('water-surface response to swimming',()=>{
  it('emits bounded ripples only when an actor actually moves on the water',()=>{
    const scene=new THREE.Scene();
    const wake=new SurfaceWake(scene,'low');
    try {
      const state=newFlightState();
      state.x=GRAND_LAKE.x;
      state.z=GRAND_LAKE.z;
      state.mode='surface';
      state.speed=7;
      wake.update(state,1);
      expect(wake.group.children.some(c=>c.visible)).toBe(true);
      state.mode='air';
      wake.update(state,8);
      expect(wake.group.children.some(c=>c.visible)).toBe(false);
    } finally {wake.dispose();}
  });
  it('keeps pool bounded with no object growth under long travel',()=>{
    const wake=new SurfaceWake(new THREE.Scene(),'low');
    try {
      const count=wake.group.children.length;
      const state=newFlightState();
      state.mode='surface';state.speed=9;
      for(let i=0;i<250;i++)wake.update(state,i*.1+1);
      expect(wake.group.children.length).toBe(count);
    } finally {wake.dispose();}
  });

  it('uses tapered open V-shaped crests rather than donut-shaped wake rings',()=>{
    const low=makeWakeCrestGeometry('low'),high=makeWakeCrestGeometry('high');
    const tex=makeWakeCrestTexture();
    try {
      expect(low.getAttribute('position').count).toBeGreaterThan(80);
      expect(high.getAttribute('position').count).toBeGreaterThan(
        low.getAttribute('position').count);
      expect(low.index?.count).toBeGreaterThan(200);
      const uv=low.getAttribute('uv'),pos=low.getAttribute('position');
      expect(uv.count).toBe(pos.count);
      // No vertex should complete a circular ring in front of the swimmer.
      for(let i=0;i<pos.count;i++){
        expect(pos.getZ(i)).toBeGreaterThan(0);
      }
      const data=tex.image.data as Uint8Array;
      const alpha=(x:number,y:number):number=>data[(y*64+x)*4+3]??0;
      expect(alpha(31,31)).toBeGreaterThan(130);
      expect(alpha(0,0)).toBe(0);
      expect(alpha(63,0)).toBe(0);
      expect(alpha(0,63)).toBe(0);
      expect(alpha(63,63)).toBe(0);
      expect(alpha(31,0)).toBe(0);
      expect(alpha(0,31)).toBe(0);
      expect(()=>makeWakeCrestTexture(4)).toThrow();
    }finally{low.dispose();high.dispose();tex.dispose();}
  });

  it('keeps a swimmer wake anchored to moving water and behind the actor',()=>{
    const wake=new SurfaceWake(new THREE.Scene(),'low');
    try {
      const state=newFlightState();
      state.x=GRAND_LAKE.x;state.z=GRAND_LAKE.z;
      state.mode='surface';state.speed=7;state.yaw=Math.PI*.5;
      wake.update(state,1);
      const trail=wake.group.children.find(c=>c.visible) as THREE.Mesh;
      expect(trail).toBeInstanceOf(THREE.Mesh);
      expect(trail.geometry).not.toBeInstanceOf(THREE.RingGeometry);
      expect(trail.rotation.y).toBeCloseTo(-Math.PI*.5,4);
      const oldY=trail.position.y;
      wake.update(state,1.08);
      expect(trail.position.y).toBeCloseTo(
        waterSurfaceAt(state.x,state.z)+waterWaveOffsetAt(state.x,state.z,1.08)+.14,5);
      expect(oldY).not.toBeCloseTo(trail.position.y,5);
      expect((trail.material as THREE.MeshBasicMaterial).map)
        .toBeInstanceOf(THREE.DataTexture);
    }finally{wake.dispose();}
  });
  it('deforms every crest vertex against the same lake waves as the swimmer',()=>{
    const wake=new SurfaceWake(new THREE.Scene(),'low');
    try {
      const state=newFlightState();
      state.x=GRAND_LAKE.x;state.z=GRAND_LAKE.z;
      state.mode='surface';state.speed=6;
      wake.update(state,1);
      const trail=wake.group.children.find(c=>c.visible) as THREE.Mesh;
      const mat=trail.material as THREE.MeshBasicMaterial;
      type Shader=Parameters<THREE.MeshBasicMaterial['onBeforeCompile']>[0];
      const shader={
        uniforms:{},
        vertexShader:'#include <common>\n#include <begin_vertex>',
        fragmentShader:'#include <common>\n#include <color_fragment>',
      } as Shader;
      mat.onBeforeCompile(shader,{} as THREE.WebGLRenderer);
      expect(shader.vertexShader).toContain('scWakeHeight(scWakeWorld.xz)');
      expect(shader.vertexShader).toContain('uScWakeAnchorWave');
      expect(shader.fragmentShader).toContain('length(shore)/boundary > .982');
      const anchor=shader.uniforms.uScWakeAnchorWave as {value:number};
      const time=shader.uniforms.uScWakeTime as {value:number};
      expect(anchor.value).toBeCloseTo(waterWaveOffsetAt(state.x,state.z,1),6);
      expect(time.value).toBe(1);
      const prev=anchor.value;
      wake.update(state,1.08);
      expect(anchor.value).toBeCloseTo(waterWaveOffsetAt(state.x,state.z,1.08),6);
      expect(anchor.value).not.toBeCloseTo(prev,6);
      expect(time.value).toBe(1.08);
      expect((shader.uniforms.uScWakeLake as {value:number}).value).toBe(1);
    }finally{wake.dispose();}
  });

  it('keeps airborne splashdown clear until the dragon contacts the water',()=>{
    const wake=new SurfaceWake(new THREE.Scene(),'low');
    try{
      const state=newFlightState();
      state.x=GRAND_LAKE.x;state.z=GRAND_LAKE.z;
      state.y=GRAND_LAKE.surfaceY+11;
      state.speed=13;
      beginTraversal(state,'splashdown',dragonSurfaceY(state.form,state.x,state.z),0);
      wake.update(state,.25);
      expect(wake.group.children.every(c=>!c.visible)).toBe(true);
      state.y=dragonSurfaceY(state.form,state.x,state.z)+.10;
      wake.update(state,.35);
      expect(wake.group.children.some(c=>c.visible)).toBe(true);
    }finally{wake.dispose();}
  });
});
