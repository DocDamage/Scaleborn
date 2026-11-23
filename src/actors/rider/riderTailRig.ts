import * as THREE from 'three';
import type { FlightState } from '../dragon/flight';
import { taperedSpine, sculptFin } from '../dragon/organicSculpt';
import type { RiderPose } from './pose';

/**
 * The heroine's original draconic tail is a single continuous, tapered skin
 * on three moving bones. It flexes when swimming, walking and balancing on
 * Onyx; it does not change the child actor, controls or any physics collider.
 */
export interface RiderTailRig {
  root: THREE.Group;
  mesh: THREE.SkinnedMesh;
  base: THREE.Bone;
  mid: THREE.Bone;
  tip: THREE.Bone;
  finSocket: THREE.Group;
}
export type RiderTailPoseTargets=Pick<RiderTailRig,'root'|'mid'|'tip'>;

const smooth=(a:number,b:number,x:number):number=>{
  const t=Math.max(0,Math.min(1,(x-a)/(b-a)));
  return t*t*(3-2*t);
};

export function createRiderTailRig(
  skin: THREE.Material, finMaterial: THREE.Material,
): RiderTailRig {
  const root=new THREE.Group();
  root.name='rider.tail';
  root.position.set(0,.71,.11);

  const geometry=taperedSpine([
    [0,0,0],[0,-.13,.19],[0,-.24,.44],
    [.09,-.21,.68],[.08,-.16,.92],
  ],.092,14,52);
  const p=geometry.getAttribute('position');
  const indices:number[]=[],weights:number[]=[];
  for(let i=0;i<p.count;i++){
    const z=p.getZ(i);
    const base=1-smooth(.14,.65,z);
    const tip=smooth(.60,.98,z);
    const mid=Math.max(0,1-base-tip);
    const sum=base+mid+tip;
    indices.push(0,1,2,0);
    weights.push(base/sum,mid/sum,tip/sum,0);
  }
  geometry.setAttribute('skinIndex',new THREE.Uint16BufferAttribute(indices,4));
  geometry.setAttribute('skinWeight',new THREE.Float32BufferAttribute(weights,4));

  const base=new THREE.Bone();
  base.name='rider.tail.base';
  const mid=new THREE.Bone();
  mid.name='rider.tail.mid';
  mid.position.set(0,-.205,.42);
  const tip=new THREE.Bone();
  tip.name='rider.tail.end';
  tip.position.set(.085,.036,.36);
  base.add(mid);
  mid.add(tip);

  const mesh=new THREE.SkinnedMesh(geometry,skin);
  mesh.name='rider.tail.skinned';
  mesh.castShadow=true;
  mesh.receiveShadow=true;
  mesh.frustumCulled=false;
  mesh.add(base);
  mesh.updateMatrixWorld(true);
  mesh.bind(new THREE.Skeleton([base,mid,tip]));
  root.add(mesh);

  // Retain the exact old fin mesh authoring coordinates at the rest pose.
  // The inverse of the tip bone's rest-space translation lets the fin move
  // with its bone without popping or teleporting on the first animation frame.
  const finSocket=new THREE.Group();
  finSocket.name='rider.tail.fins';
  finSocket.position.set(-.085,.169,-.78);
  finSocket.add(sculptFin(
    [.08,-.16,.82],[.15,-.10,1.08],.19,finMaterial,'rider.tail-tip'));
  tip.add(finSocket);
  return {root,mesh,base,mid,tip,finSocket};
}

/** Bone-only presentation pose, deterministic and robust to invalid telemetry. */
export function poseRiderTail(
  rig:RiderTailPoseTargets, state:FlightState, pose:RiderPose,
):void {
  const time=Number.isFinite(state.time)?state.time:0;
  const roll=Number.isFinite(state.roll)
    ? Math.max(-.8,Math.min(.8,state.roll)):0;
  const riderSpeed=Number.isFinite(state.riderSpeed)
    ? Math.min(1,Math.abs(state.riderSpeed)/4):0;
  const swim=pose.motion==='swim'||pose.motion==='dive';
  const mounted=pose.motion==='mounted';
  const walk=pose.motion==='walk';
  const rate=swim?4.8:walk?5.3:2.15;
  const flex=swim?.19:walk?.105*riderSpeed:mounted?.075:.045;
  const phase=time*rate;
  rig.root.rotation.y=.04*Math.sin(phase)+(mounted?roll*.12:0);
  rig.root.rotation.x=swim?.035*Math.sin(phase*.8):-.04;
  rig.mid.rotation.y=Math.sin(phase+.22)*flex+(mounted?roll*.13:0);
  rig.tip.rotation.y=Math.sin(phase-.62)*flex*1.45+(mounted?roll*.15:0);
  rig.mid.rotation.x=Math.sin(phase*.72-.3)*flex*.36;
  rig.tip.rotation.x=Math.sin(phase*.86-.82)*flex*.52;
  rig.mid.rotation.z=Math.sin(phase*.63)*flex*.18;
  rig.tip.rotation.z=Math.sin(phase*.74-.45)*flex*.22;
}
