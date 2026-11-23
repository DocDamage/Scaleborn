import * as THREE from 'three';
import { RIDER_SPINE_PIVOT_Y } from './riderUpperBodyRig';

/**
 * The fitted coat is parented to the new flexible chest pivot. Without a
 * counter-fold the coat hem rotates away from the stationary hips and tail
 * whenever the child banks or leans. Four small, bounded, normal-correct
 * morphs keep the original lower seam close to the pelvis while the shoulders
 * follow the spine. This corrects only render geometry, not mount contact.
 */
export const RIDER_COAT_PITCH_RANGE=.24;
export const RIDER_COAT_BANK_RANGE=.40;

export function installRiderCoatWaistMorph(coat:THREE.Mesh):void {
  const geo=coat.geometry;
  const p=geo.getAttribute('position'),uv=geo.getAttribute('uv');
  if(!p||!uv||p.count!==uv.count||!geo.index
    ||geo.morphAttributes.position?.length){
    throw new Error('Fitted coat needs one unmorphed indexed UV loft');
  }
  const targets:number[][]=[[],[],[],[]];
  for(let i=0;i<p.count;i++){
    const x=p.getX(i),y=p.getY(i),z=p.getZ(i);
    const ratio=Math.min(1,Math.max(0,(.85-y)/.25));
    const hem=ratio*ratio*(3-2*ratio);
    const height=(y-RIDER_SPINE_PIVOT_Y)*hem;
    // First two correct pitch at the pelvis, second two correct bank.
    targets[0]!.push(x,y,z-RIDER_COAT_PITCH_RANGE*height);
    targets[1]!.push(x,y,z+RIDER_COAT_PITCH_RANGE*height);
    targets[2]!.push(x+RIDER_COAT_BANK_RANGE*height,y,z);
    targets[3]!.push(x-RIDER_COAT_BANK_RANGE*height,y,z);
  }
  const normals:THREE.BufferAttribute[]=[];
  for(const vertices of targets){
    const temp=new THREE.BufferGeometry();
    temp.setIndex(geo.index.clone());
    temp.setAttribute('position',new THREE.Float32BufferAttribute(vertices,3));
    temp.computeVertexNormals();
    normals.push((temp.getAttribute('normal') as THREE.BufferAttribute).clone());
    temp.dispose();
  }
  geo.morphAttributes.position=targets.map(values=>
    new THREE.Float32BufferAttribute(values,3));
  geo.morphAttributes.normal=normals;
  geo.morphTargetsRelative=false;
  coat.updateMorphTargets();
  geo.computeBoundingSphere();
  if(geo.boundingSphere)geo.boundingSphere.radius+=.12;
}

/** Opposing corrections are never blended at once; no geometry updates. */
export function poseRiderCoatWaist(
  coat:THREE.Mesh,spinePitch:number,spineBank:number,
):void {
  const influences=coat.morphTargetInfluences;
  if(!influences||influences.length!==4)return;
  const safe=(n:number):number=>Number.isFinite(n)?n:0;
  const pitch=Math.max(-1,Math.min(1,safe(spinePitch)/RIDER_COAT_PITCH_RANGE));
  const bank=Math.max(-1,Math.min(1,safe(spineBank)/RIDER_COAT_BANK_RANGE));
  influences[0]=Math.max(0,pitch);
  influences[1]=Math.max(0,-pitch);
  influences[2]=Math.max(0,bank);
  influences[3]=Math.max(0,-bank);
}
