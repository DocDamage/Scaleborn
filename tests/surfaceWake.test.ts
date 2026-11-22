import * as THREE from 'three';
import { describe, expect, it } from 'vitest';
import { SurfaceWake } from '../src/world/surfaceWake';
import { newFlightState } from '../src/actors/dragon/flight';
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
});
