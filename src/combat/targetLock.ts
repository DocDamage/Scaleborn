import type { FlightState, InteractionResult } from '../actors/dragon/flight';
import type { CombatState, GloamHound } from './combat';

/**
 * Non-rendering, deterministic one-target camera aid. It only selects living
 * Gloam hounds, never modifies simulation coordinates, enemy HP or attack
 * outcomes. Stable enemy IDs survive future visual/model replacements.
 */
const LOCK_RANGE = 76;
const RELEASE_RANGE = 104;

function actor(s: FlightState): { x:number; y:number; z:number; yaw:number } {
  return s.controlTarget === 'rider'
    ? { x:s.riderX,y:s.riderY,z:s.riderZ,yaw:s.riderYaw }
    : { x:s.x,y:s.y,z:s.z,yaw:s.yaw };
}

function distance(a:{x:number;y:number;z:number},h:GloamHound):number {
  return Math.hypot(h.x-a.x,h.y+1.25-a.y,h.z-a.z);
}

export class CombatTargetLock {
  private selected: string | null = null;

  get targetId(): string | null { return this.selected; }

  clear(): void { this.selected = null; }

  current(c: CombatState,s:FlightState): GloamHound | null {
    if (!this.selected) return null;
    const found = c.hounds.find(h=>h.id===this.selected);
    const a=actor(s);
    if (!found || found.hp<=0 || distance(a,found)>RELEASE_RANGE
      || (s.controlTarget==='rider' && s.riderMode==='underwater')
      || (s.controlTarget==='dragon' && s.mode==='underwater')) {
      this.clear();
      return null;
    }
    return found;
  }

  toggle(c: CombatState,s:FlightState): InteractionResult {
    if (this.current(c,s)) {
      this.clear();
      return {ok:true,message:'Target lock released.'};
    }
    if ((s.controlTarget==='rider' && s.riderMode==='underwater')
      || (s.controlTarget==='dragon' && s.mode==='underwater')) {
      return {ok:false,message:'No visible ground targets underwater.'};
    }
    const a=actor(s);
    const forwardX=Math.sin(a.yaw),forwardZ=-Math.cos(a.yaw);
    let winner:GloamHound|null=null;
    let best=Number.POSITIVE_INFINITY;
    for (const h of c.hounds) {
      if (h.hp<=0)continue;
      const dx=h.x-a.x,dz=h.z-a.z;
      const planar=Math.hypot(dx,dz);
      const d=distance(a,h);
      if (d>LOCK_RANGE || planar<.25) continue;
      const facing=(dx*forwardX+dz*forwardZ)/planar;
      if (facing<.16)continue;
      // A visible, centered enemy is preferred, but nearby threats take
      // precedence over distant ones. Original array order is stable on ties.
      const score=d+(1-facing)*26;
      if (score<best) {best=score;winner=h;}
    }
    if (!winner) return {ok:false,message:'No Gloam threat in front to lock.'};
    this.selected=winner.id;
    return {ok:true,message:'Target locked.'};
  }
}
