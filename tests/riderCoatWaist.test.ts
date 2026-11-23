import * as THREE from 'three';
import { describe, expect, it } from 'vitest';
import { makeScalebornRider } from '../src/actors/rider/heroSculpt';
import { DragonVisual } from '../src/actors/dragon/visual';
import { newFlightState } from '../src/actors/dragon/flight';
import {
  RIDER_COAT_BANK_RANGE,RIDER_COAT_PITCH_RANGE,poseRiderCoatWaist,
} from '../src/actors/rider/riderCoatWaist';

describe('original rider fitted-coat waist seam during spine banking',()=>{
  it('stabilizes the hem while retaining the original pinned collar and woven PBR',()=>{
    const rider=makeScalebornRider();
    try{
      const coat=rider.getObjectByName('rider.fitted-coat') as THREE.Mesh;
      const spine=rider.getObjectByName('rider.spine') as THREE.Group;
      const leg=rider.getObjectByName('rider.leftLeg') as THREE.Group;
      expect(coat).toBeInstanceOf(THREE.Mesh);
      expect(spine.getObjectByName('rider.fitted-coat')).toBe(coat);
      expect(leg.parent).toBe(rider);
      const geometry=coat.geometry;
      const p=geometry.getAttribute('position');
      expect(geometry.morphAttributes.position).toHaveLength(4);
      expect(geometry.morphAttributes.normal).toHaveLength(4);
      expect(coat.morphTargetInfluences).toHaveLength(4);
      expect(geometry.morphTargetsRelative).toBe(false);
      expect(geometry.getAttribute('uv').count).toBe(p.count);
      expect((coat.material as THREE.MeshStandardMaterial).map)
        .toBeInstanceOf(THREE.DataTexture);
      const motion=[0,0,0,0];
      for(let j=0;j<4;j++){
        const target=geometry.morphAttributes.position[j]!;
        const normals=geometry.morphAttributes.normal[j]!;
        expect(target.count).toBe(p.count);
        expect(normals.count).toBe(p.count);
        for(let i=0;i<p.count;i++){
          const delta=Math.hypot(target.getX(i)-p.getX(i),
            target.getY(i)-p.getY(i),target.getZ(i)-p.getZ(i));
          expect([delta,normals.getX(i),normals.getY(i),normals.getZ(i)]
            .every(Number.isFinite)).toBe(true);
          if(p.getY(i)>.86)expect(delta).toBeLessThan(1e-6);
          motion[j]=Math.max(motion[j]!,delta);
        }
      }
      expect(motion[0]).toBeGreaterThan(.04);
      expect(motion[1]).toBeGreaterThan(.04);
      expect(motion[2]).toBeGreaterThan(.075);
      expect(motion[3]).toBeGreaterThan(.075);
    }finally{
      rider.traverse(o=>{if(o instanceof THREE.Mesh)o.geometry.dispose();});
    }
  });

  it('responds to both mounted lean and banking without changing child body scale',()=>{
    const dragon=new DragonVisual(),state=newFlightState();
    try{
      const coat=dragon.rider.getObjectByName('rider.fitted-coat') as THREE.Mesh;
      state.form='rideable';state.mode='air';state.pitch=-.7;
      state.roll=.6;state.speed=0;state.time=1;
      dragon.update(state);
      expect(coat.morphTargetInfluences?.[0]).toBeGreaterThan(0);
      expect(coat.morphTargetInfluences?.[3]).toBeGreaterThan(0);
      expect(coat.morphTargetInfluences?.[1]).toBe(0);
      expect(coat.morphTargetInfluences?.[2]).toBe(0);
      state.mode='ground';state.pitch=0;state.roll=0;state.speed=0;state.time=1.2;
      dragon.update(state);
      expect(coat.morphTargetInfluences).toEqual([0,0,0,0]);
      expect(dragon.rider.scale.x).toBe(1);
      expect(dragon.rider.getObjectByName('rider.tail')).toBeDefined();
    }finally{dragon.dispose();}
  });

  it('rejects nonfinite angles and does not allocate positions while posing',()=>{
    const mesh=new THREE.Mesh();
    poseRiderCoatWaist(mesh,.1,.2);
    expect(mesh.morphTargetInfluences).toBeUndefined();
    mesh.morphTargetInfluences=[0,0,0,0];
    poseRiderCoatWaist(mesh,Infinity,NaN);
    expect(mesh.morphTargetInfluences).toEqual([0,0,0,0]);
    poseRiderCoatWaist(mesh,RIDER_COAT_PITCH_RANGE,RIDER_COAT_BANK_RANGE);
    expect(mesh.morphTargetInfluences).toEqual([1,0,1,0]);
    poseRiderCoatWaist(mesh,-99,-99);
    expect(mesh.morphTargetInfluences).toEqual([0,1,0,1]);
  });
});
