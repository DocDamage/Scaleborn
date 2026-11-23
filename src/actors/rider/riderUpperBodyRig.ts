import * as THREE from 'three';
import type { FlightState } from '../dragon/flight';
import type { RiderPose } from './pose';

/**
 * An original render-only thoracic joint. The heroine's coat, head, sleeves
 * and collar can lean independently while her pelvis, legs and tail remain
 * planted on Onyx. Her original authored coordinates are preserved by the
 * paired +pivot/-rest offsets; no collision, mount socket or actor ID moves.
 */
export const RIDER_SPINE_PIVOT_Y=.81;

const upperParts=[
  'rider.head','rider.fitted-coat','rider.coat-lapel.left',
  'rider.coat-lapel.right','rider.neck','rider.leftArm',
  'rider.rightArm','rider.bond-pendant','rider.travel-cloak',
] as const;

export function installRiderUpperBody(rider:THREE.Group):THREE.Group {
  if(rider.getObjectByName('rider.spine')) {
    throw new Error('Rider upper-body pivot already installed');
  }
  const parts=upperParts.map(name=>{
    const node=rider.children.find(child=>child.name===name);
    if(!node)throw new Error('Missing original rider torso node: '+name);
    return node;
  });
  const pivot=new THREE.Group();
  pivot.name='rider.spine';
  pivot.position.y=RIDER_SPINE_PIVOT_Y;
  const rest=new THREE.Group();
  rest.name='rider.spine-rest-space';
  rest.position.y=-RIDER_SPINE_PIVOT_Y;
  for(const part of parts)rest.add(part);
  pivot.add(rest);
  rider.add(pivot);
  return pivot;
}

export interface RiderUpperBodyPose {
  pelvisPitch:number;
  pelvisBank:number;
  spinePitch:number;
  spineBank:number;
  spineYaw:number;
}

const finite=(n:number):number=>Number.isFinite(n)?n:0;
const clamp=(n:number,a:number,b:number):number=>
  Math.max(a,Math.min(b,n));

/**
 * Preserve the previous upper-body lean while removing most of that motion
 * from the seated hips. The pelvis still carries a small grounded response.
 * No frame-history smoothing or physics integration is hidden in this pose.
 */
export function riderUpperBodyPose(
  state:FlightState,pose:RiderPose,mountedBank?:number,
):RiderUpperBodyPose {
  const lean=clamp(finite(pose.torsoLean),-.35,.35);
  const roll=clamp(finite(state.roll),-.8,.8);
  const time=finite(state.time);
  const mounted=pose.motion==='mounted';
  const bank=mounted
    ? Number.isFinite(mountedBank)
      ? clamp(mountedBank!,-.5,.5) : -roll*.24
    : pose.motion==='swim'||pose.motion==='dive'
      ? .08*Math.sin(time*4.2):0;
  const chestYaw=mounted?-roll*.048:
    pose.motion==='walk' ? .018*Math.sin(time*7.2) : 0;
  return {
    pelvisPitch:lean*.20,
    pelvisBank:bank*.20,
    spinePitch:lean*.80,
    spineBank:bank*.80,
    spineYaw:chestYaw,
  };
}
