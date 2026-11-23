import * as THREE from 'three';
import { taperedSpine } from '../dragon/organicSculpt';
import type { FlightState } from '../dragon/flight';
import type { RiderMotion } from './pose';

/**
 * The original girl's loose, narrow coastal-travel hair locks. Short layered
 * strands grow behind the temple scale patches and BELOW her horn bases:
 * no elf ears, heavy helmet silhouette, donor mesh or new child-scale rig.
 */
export function makeRiderHairLock(
  side:-1|1, material:THREE.Material,
):THREE.Group {
  const pivot=new THREE.Group();
  pivot.name=side<0?'rider.hair-lock.left':'rider.hair-lock.right';
  pivot.position.set(side*.128,1.442,.046);
  for(let i=0;i<4;i++){
    const row=i/3;
    const start=side*(row-.5)*.031;
    const z=.014+row*.010;
    const width=.021+(1-row)*.016;
    const length=.144+row*.044;
    const points: [number,number,number][]=[
      [start,0,z],
      [start+side*.014,-.034,z+.019],
      [start+side*.033,-.083,z+.036],
      [start+side*(.035+.012*row),-length*.78,z+.024],
      [start+side*(.031+.019*row),-length,z+.006],
    ];
    const mesh=new THREE.Mesh(
      taperedSpine(points,width,10,25),material);
    mesh.name='rider.hair-strand.'+i;
    mesh.castShadow=true;
    pivot.add(mesh);
  }
  return pivot;
}

/** Head-local movement only; head/face/horn ownership never changes. */
export interface HairSway { pitch:number; yaw:number; roll:number }
export function riderHairSway(
  state:FlightState,motion:RiderMotion,side:-1|1,
):HairSway {
  const t=Number.isFinite(state.time)?state.time:0;
  const mounted=motion==='mounted';
  const roll=Number.isFinite(state.roll)
    ? Math.max(-.8,Math.min(.8,state.roll)):0;
  const speed=mounted
    ? Number.isFinite(state.speed)?Math.max(0,Math.min(35,Math.abs(state.speed))):0
    : Number.isFinite(state.riderSpeed)
      ? Math.max(0,Math.min(8,Math.abs(state.riderSpeed))):0;
  const motionAmount=motion==='walk'?.040:
    motion==='swim'||motion==='dive'?.075:mounted?.055:.015;
  const phase=t*(motion==='swim'||motion==='dive'?4.8:2.2);
  return {
    pitch:-.018-.045*Math.min(1,speed/14)
      +Math.sin(phase+side*.48)*motionAmount,
    yaw:side*(.008+.012*Math.sin(phase*.67+side*.7))
      -roll*.045,
    roll:side*(.012+.025*Math.sin(phase+side*.6))
      -roll*.060,
  };
}

export function poseRiderHairLocks(
  left:THREE.Group,right:THREE.Group,
  state:FlightState,motion:RiderMotion,
):void {
  for(const [side,lock] of [[-1,left],[1,right]] as const){
    const p=riderHairSway(state,motion,side);
    lock.rotation.set(p.pitch,p.yaw,p.roll);
  }
}
