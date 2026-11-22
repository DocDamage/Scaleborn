import * as THREE from 'three';
import { describe, expect, it } from 'vitest';
import { CreatureSplash } from '../src/world/creatureSplash';
import { newFlightState } from '../src/actors/dragon/flight';
import { beginTraversal } from '../src/actors/dragon/traversalTransition';
import { dragonSurfaceY } from '../src/world/waterPhysics';
import { GRAND_LAKE } from '../src/world/highlandLake';

describe('actual creature/water contact, not effects in midair',()=>{
  it('emits spray only once the splashdown actually reaches water',()=>{
    const scene=new THREE.Scene();
    const splash=new CreatureSplash(scene,'low');
    const state=newFlightState();
    state.x=GRAND_LAKE.x;state.z=GRAND_LAKE.z;
    state.y=GRAND_LAKE.surfaceY+13;
    state.speed=12;
    beginTraversal(state,'splashdown',
      dragonSurfaceY(state.form,state.x,state.z),0);
    try{
      splash.update(state,0);
      expect(splash.spray.count).toBe(0);
      state.y=dragonSurfaceY(state.form,state.x,state.z)+.18;
      splash.update(state,.06);
      expect(splash.spray.count).toBeGreaterThan(0);
      const initial=splash.spray.count;
      splash.update(state,.09);
      expect(splash.spray.count).toBeLessThanOrEqual(initial);
      expect(splash.group.children.length).toBe(1);
      splash.update(state,5);
      expect(splash.spray.count).toBe(0);
    }finally{splash.dispose();}
  });

  it('scales a fixed particle pool and emits when the independent rider enters water',()=>{
    const low=new CreatureSplash(new THREE.Scene(),'low');
    const high=new CreatureSplash(new THREE.Scene(),'high');
    try{
      expect(low.spray.instanceMatrix.count).toBeLessThan(high.spray.instanceMatrix.count);
      const state=newFlightState();
      state.riderX=GRAND_LAKE.x;
      state.riderZ=GRAND_LAKE.z;
      state.riderMode='ground';
      low.update(state,1);
      state.riderMode='surface';
      low.update(state,1.05);
      expect(low.spray.count).toBeGreaterThan(0);
      expect(low.spray.geometry.getAttribute('uv').count).toBe(12);
      expect((low.spray.material as THREE.MeshBasicMaterial).map)
        .toBeInstanceOf(THREE.DataTexture);
      expect(low.group.children.length).toBe(1);
    }finally{low.dispose();high.dispose();}
  });
});
