import { describe,expect,it } from 'vitest';
import { CombatTargetLock } from '../src/combat/targetLock';
import { newFlightState } from '../src/actors/dragon/flight';
import { newCombatState } from '../src/combat/combat';
import { heightAt } from '../src/world/terrain';

describe('stable, deterministic Gloam target lock',()=>{
  it('selects a living enemy in front and releases on repeated L action',()=>{
    const lock=new CombatTargetLock(),combat=newCombatState(),s=newFlightState();
    const h=combat.hounds[0]!;
    s.x=h.x-12;s.z=h.z;s.y=heightAt(s.x,s.z)+2;
    s.yaw=Math.PI/2;s.mode='ground';s.controlTarget='dragon';
    const picked=lock.toggle(combat,s);
    expect(picked.ok).toBe(true);
    expect(lock.targetId).toBe(h.id);
    expect(lock.current(combat,s)?.id).toBe(h.id);
    expect(lock.toggle(combat,s).ok).toBe(true);
    expect(lock.current(combat,s)).toBeNull();
    expect(lock.targetId).toBeNull();
  });

  it('never acquires behind, dead, distant or submerged threats',()=>{
    const lock=new CombatTargetLock(),combat=newCombatState(),s=newFlightState();
    const h=combat.hounds[0]!;
    for(const foe of combat.hounds.slice(1))foe.hp=0;
    s.x=h.x-12;s.z=h.z;s.y=heightAt(s.x,s.z)+2;
    s.mode='ground';s.yaw=-Math.PI/2;
    expect(lock.toggle(combat,s).ok).toBe(false);
    s.yaw=Math.PI/2;
    expect(lock.toggle(combat,s).ok).toBe(true);
    s.x+=145;
    expect(lock.current(combat,s)).toBeNull();
    s.x=h.x-12;
    h.hp=0;
    expect(lock.toggle(combat,s).ok).toBe(false);
    h.hp=20;s.mode='underwater';
    expect(lock.toggle(combat,s).ok).toBe(false);
    s.mode='ground';
    expect(lock.toggle(combat,s).ok).toBe(true);
    h.hp=0;
    expect(lock.current(combat,s)).toBeNull();
  });

  it('respects separately controlled unscaled rider and stable actor selection',()=>{
    const lock=new CombatTargetLock(),combat=newCombatState(),s=newFlightState();
    const h=combat.hounds[0]!;
    for(const foe of combat.hounds.slice(1))foe.hp=0;
    s.controlTarget='rider';s.form='small';
    s.riderX=h.x-8;s.riderZ=h.z;
    s.riderY=heightAt(s.riderX,s.riderZ)+.05;
    s.riderYaw=Math.PI/2;s.riderMode='ground';
    expect(lock.toggle(combat,s).ok).toBe(true);
    expect(lock.current(combat,s)?.id).toBe(h.id);
    s.riderMode='underwater';
    expect(lock.current(combat,s)).toBeNull();
  });
});
