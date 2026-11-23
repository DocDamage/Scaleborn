import * as THREE from 'three';
import type { DragonPose } from './animationPose';

/**
 * Original Onyx wing-sail tension, authored in the exact three-bone membrane
 * bind space. The leading edge, scalloped trailing edge, shoulder and distal
 * fingertip stay pinned; only the broad internal sail gains a soft bow.
 * This second morph is compatible with the existing folded-sail morph and
 * receives its own normals for stable painterly lighting.
 */
export function installWingBillowMorph(geometry:THREE.BufferGeometry):void {
  const position=geometry.getAttribute('position');
  const uv=geometry.getAttribute('uv');
  const foldTargets=geometry.morphAttributes.position;
  const foldNormals=geometry.morphAttributes.normal;
  if(!geometry.index||!position||!uv||uv.count!==position.count
      ||foldTargets?.length!==1||foldNormals?.length!==1) {
    throw new Error('Wing billow needs the existing indexed folded membrane');
  }
  const next=new Float32Array(position.count*3);
  for(let i=0;i<position.count;i++){
    const x=position.getX(i),y=position.getY(i),z=position.getZ(i);
    const span=uv.getX(i),chord=uv.getY(i);
    // Narrow leading and trailing edges stay directly on the cartilage.
    // Fall to zero also at the wing root and final finger tip.
    const edge=Math.sin(Math.PI*chord)**1.25;
    const spanFade=Math.sin(Math.PI*span)**.82;
    const tension=edge*spanFade;
    const ripples=Math.sin(span*8.4-chord*4.6);
    const displacement=tension*(.052+.021*ripples);
    next[i*3]=x;
    next[i*3+1]=y+displacement;
    next[i*3+2]=z+.010*tension*Math.sin(chord*12.0+span*6.2);
  }
  const positions=new THREE.Float32BufferAttribute(next,3);
  const temporary=new THREE.BufferGeometry();
  temporary.setIndex(geometry.index.clone());
  temporary.setAttribute('position',new THREE.Float32BufferAttribute(next,3));
  temporary.computeVertexNormals();
  const normals=(temporary.getAttribute('normal') as THREE.BufferAttribute).clone();
  temporary.dispose();
  geometry.morphAttributes.position.push(positions);
  geometry.morphAttributes.normal.push(normals);
}

/**
 * Wing-sail motion is subordinate to folding. The wing bones still own
 * flapping, flight control and physical dimensions; this is render-only.
 * No frame delta, randomness or dynamic geometry allocations.
 */
export function wingBillowInfluence(pose:DragonPose):number {
  const fold=Number.isFinite(pose.wingFold)
    ? Math.max(0,Math.min(1,pose.wingFold)):1;
  const flap=Number.isFinite(pose.flapAmount)
    ? Math.max(0,Math.min(1,Math.abs(pose.flapAmount))):0;
  const phase=Number.isFinite(pose.flapPhase)?pose.flapPhase:0;
  const openness=1-fold*fold*(3-2*fold);
  const pulse=.55+.35*Math.sin(phase-.42);
  return Math.max(0,Math.min(.85,openness*flap*1.20*pulse));
}
