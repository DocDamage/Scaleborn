import * as THREE from 'three';
import {describe,expect,it} from 'vitest';
import {onyxSurfaceOffset} from '../src/actors/dragon/onyxSurfaceAnatomy';
import {loftDragon,ONYX_HEAD} from '../src/actors/dragon/organicSculpt';
import {DragonVisual} from '../src/actors/dragon/visual';

describe('screenshot-guided original Onyx nasal dorsum sculpt',()=>{
  it('raises an axial organic snout ridge while preserving wedge-tip taper',()=>{
    const middle=onyxSurfaceOffset('skull',-.95,0,1);
    const lateral=onyxSurfaceOffset('skull',-.95,.75,.661);
    const tip=onyxSurfaceOffset('skull',-1.44,0,1);
    expect(middle.y).toBeGreaterThan(lateral.y+.035);
    expect(middle.y).toBeGreaterThan(tip.y+.040);
    const left=onyxSurfaceOffset('skull',-1.04,-.5,.866);
    const right=onyxSurfaceOffset('skull',-1.04,.5,.866);
    expect(left.y).toBeCloseTo(right.y,7);
    expect(left.x).toBeCloseTo(-right.x,7);
    expect(onyxSurfaceOffset('skull',-1.04,0,-1).y)
      .toBeLessThan(middle.y);
  });

  it('positions both nostrils outside the refined muzzle with finite normals',()=>{
    const dragon=new DragonVisual();
    const head=dragon.root.getObjectByName('creature.dragon.onyx.sculpted-skull') as THREE.Mesh;
    try{
      const skull=loftDragon(ONYX_HEAD,76,36,'skull');
      try{
        const p=skull.getAttribute('position'),n=skull.getAttribute('normal');
        expect(n.count).toBe(p.count);
        for(let i=0;i<p.count;i++)expect([
          p.getX(i),p.getY(i),p.getZ(i),
          n.getX(i),n.getY(i),n.getZ(i),
        ].every(Number.isFinite)).toBe(true);
      }finally{skull.dispose();}
      for(const side of ['left','right']){
        const nostril=dragon.root.getObjectByName('creature.dragon.nostril.'+side) as THREE.Mesh;
        expect(nostril).toBeInstanceOf(THREE.Mesh);
        nostril.geometry.computeBoundingBox();
        expect(nostril.geometry.boundingBox!.max.y).toBeGreaterThan(.13);
      }
      expect(head).toBeInstanceOf(THREE.Mesh);
      expect(dragon.root.userData.assetId).toBe('creature.dragon.onyx');
      expect(dragon.rider.scale.x).toBe(1);
    }finally{dragon.dispose();}
  });
});
