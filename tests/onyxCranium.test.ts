import { describe, expect, it } from 'vitest';
import { DragonVisual } from '../src/actors/dragon/visual';
import { loftDragon, ONYX_HEAD } from '../src/actors/dragon/organicSculpt';
import { onyxSurfaceOffset } from '../src/actors/dragon/onyxSurfaceAnatomy';

describe('original Onyx reptilian muzzle and cranial proportions',()=>{
  it('narrows the unclosed old blunt face into an almost-closed wedge tip',()=>{
    const front=ONYX_HEAD[0]!,muzzle=ONYX_HEAD[3]!,cheek=ONYX_HEAD[6]!;
    expect(front[0]).toBeLessThan(-1.4);
    expect(front[2]).toBeLessThan(.015);
    expect(front[3]).toBeLessThan(.015);
    expect(muzzle[2]).toBeGreaterThan(front[2]*20);
    expect(cheek[2]).toBeGreaterThan(muzzle[2]*1.4);
    const lower=onyxSurfaceOffset('skull',-.98,.75,-.7);
    const upper=onyxSurfaceOffset('skull',-.98,.75,.7);
    expect(lower.x).toBeLessThan(upper.x);
    expect(onyxSurfaceOffset('skull',-.98,-.75,-.7).x)
      .toBeCloseTo(-lower.x,8);
  });

  it('retains outward closed-tip normals, expressive eyes and original sockets',()=>{
    const geo=loftDragon(ONYX_HEAD,82,40,'skull');
    try{
      const p=geo.getAttribute('position'),n=geo.getAttribute('normal');
      for(let i=0;i<p.count;i++){
        expect([p.getX(i),p.getY(i),p.getZ(i),
          n.getX(i),n.getY(i),n.getZ(i)]
          .every(Number.isFinite)).toBe(true);
      }
      expect(p.count).toBeGreaterThan(3000);
      // Polygon ring no longer ends in a visible 28cm-wide hole.
      const tipWidth=Math.abs(p.getX(0)-p.getX(20));
      expect(tipWidth).toBeLessThan(.04);
    }finally{geo.dispose();}
    const visual=new DragonVisual();
    try{
      for(const name of [
        'creature.dragon.onyx.sculpted-skull',
        'creature.dragon.onyx.jaw-hinge',
        'creature.dragon.eye.iris.left',
        'creature.dragon.eye.iris.right',
        'creature.dragon.horn.left','creature.dragon.horn.right',
      ])expect(visual.root.getObjectByName(name),name).toBeDefined();
      expect(visual.rider.scale.x).toBe(1);
    }finally{visual.dispose();}
  });
});
