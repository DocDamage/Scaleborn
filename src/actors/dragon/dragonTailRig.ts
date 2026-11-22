import * as THREE from 'three';
import { loftDragon } from './organicSculpt';
import type { DragonPose } from './animationPose';

/**
 * Original Onyx tail with continuous skin weights across three articulated
 * joints. The dorsal/body junction stays anchored while mid and tip bend
 * smoothly during walking, flying, banking and underwater strokes.
 *
 * The fin socket remains 'tailTip', compatible with legacy gameplay and
 * future authored GLB rigs. This changes appearance, not collision geometry.
 */
export interface DragonTailRig {
  root: THREE.Group;
  mesh: THREE.SkinnedMesh;
  base: THREE.Bone;
  mid: THREE.Bone;
  tip: THREE.Bone;
  finSocket: THREE.Group;
}

const clamp01=(x:number):number=>Math.max(0,Math.min(1,x));

export function createDragonTailRig(material:THREE.Material):DragonTailRig {
  const root=new THREE.Group();
  root.name='tailTip';
  root.position.set(0,0,1.38);

  const geometry=loftDragon([
    [-.05,-.08,.31,.29], [.38,-.08,.34,.27],
    [.78,-.10,.27,.21], [1.19,-.10,.19,.16],
    [1.67,-.13,.12,.11], [2.23,-.16,.055,.052],
    [2.49,-.16,.014,.014],
  ],92,28);
  const positions=geometry.getAttribute('position');
  const indices:number[]=[];
  const weights:number[]=[];
  for(let i=0;i<positions.count;i++){
    const z=positions.getZ(i);
    // Smooth overlap rather than one rigid section per bone. At every vertex
    // the contributions sum to one, so the surface cannot pull apart.
    const base=1-clamp01((z-.22)/1.23);
    const tip=clamp01((z-1.18)/1.22);
    const mid=Math.max(0,1-base-tip);
    const sum=base+mid+tip;
    indices.push(0,1,2,0);
    weights.push(base/sum,mid/sum,tip/sum,0);
  }
  geometry.setAttribute('skinIndex',new THREE.Uint16BufferAttribute(indices,4));
  geometry.setAttribute('skinWeight',new THREE.Float32BufferAttribute(weights,4));

  const base=new THREE.Bone();
  base.name='tailTip.base';
  const mid=new THREE.Bone();
  mid.name='tailTip.mid';
  mid.position.z=1.02;
  const tip=new THREE.Bone();
  tip.name='tailTip.end';
  tip.position.z=1.14;
  base.add(mid);mid.add(tip);

  const mesh=new THREE.SkinnedMesh(geometry,material);
  mesh.name='creature.dragon.onyx.skinned-tail';
  mesh.castShadow=true;
  mesh.receiveShadow=true;
  mesh.frustumCulled=false;
  mesh.add(base);
  mesh.updateMatrixWorld(true);
  mesh.bind(new THREE.Skeleton([base,mid,tip]));
  root.add(mesh);

  const finSocket=new THREE.Group();
  finSocket.name='tailTip.fins';
  // Fins are authored in tail-root coordinates around z≈2.15–2.85.
  // An inverse bind offset places them at those exact same coordinates while
  // parenting to the moving end bone.
  finSocket.position.z=-2.16;
  tip.add(finSocket);

  return {root,mesh,base,mid,tip,finSocket};
}

/** Pose joints without overriding the fixed-step movement/controller. */
export function poseDragonTail(rig:DragonTailRig,pose:DragonPose,time:number):void {
  const swimming=pose.name==='swim'||pose.name==='dive';
  const walking=pose.name==='walk';
  const surge=pose.name==='surge';
  const amplitude=swimming?.20:walking?.12:surge?.09:.065;
  const frequency=swimming?5.6:walking?3.5:surge?3.6:2.2;
  const phase=time*frequency;
  rig.root.rotation.y=pose.tailAngle*.18;
  rig.mid.rotation.y=pose.tailAngle*.54+Math.sin(phase+.15)*amplitude;
  rig.tip.rotation.y=pose.tailAngle*.62+Math.sin(phase-.62)*amplitude*1.35;
  rig.root.rotation.x=Math.sin(time*1.65)*.035;
  rig.mid.rotation.x=Math.sin(phase*.63-.40)*amplitude*.42;
  rig.tip.rotation.x=Math.sin(phase*.72-1.02)*amplitude*.64;
  rig.mid.rotation.z=Math.sin(phase*.58+.65)*amplitude*.20;
  rig.tip.rotation.z=Math.sin(phase*.61-1.2)*amplitude*.24;
}
