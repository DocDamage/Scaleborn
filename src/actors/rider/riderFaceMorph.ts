import * as THREE from 'three';

/**
 * Minimal original facial shape keys for the 13-year-old hybrid heroine.
 * Small volumes in the same continuous face loft lift the cheeks and settle
 * the outer eye/temple under effort, instead of moving separate cartoon
 * spheres. The original eyes/horns and head pivot remain untouched.
 *
 * Two static morph targets, each with normals, allow GPU-only deformation.
 * They never mutate the bind pose or allocate buffers during gameplay.
 */
export const RIDER_FACE_MORPHS=['cheek-lift','alert-focus'] as const;

const gaussian=(value:number,center:number,width:number):number=>{
  const x=(value-center)/width;
  return Math.exp(-2*x*x);
};

export function installRiderFaceMorphs(face:THREE.Mesh):void {
  const geo=face.geometry;
  if(geo.morphAttributes.position?.length) {
    throw new Error('Original rider face morphs already installed');
  }
  const p=geo.getAttribute('position'),uv=geo.getAttribute('uv');
  if(!p||!uv||p.count!==uv.count||!geo.index) {
    throw new Error('The sculpted rider face requires indexed UV geometry');
  }
  const cheek=new Float32Array(p.count*3);
  const focus=new Float32Array(p.count*3);
  for(let i=0;i<p.count;i++){
    const x=p.getX(i),y=p.getY(i),z=p.getZ(i);
    const angle=uv.getX(i)*Math.PI*2;
    const forward=Math.max(0,-Math.sin(angle));
    const side=Math.sign(x);
    const cheekZone=forward*gaussian(y,1.300,.082)
      *gaussian(Math.abs(x),.116,.084);
    const mouthZone=forward*gaussian(y,1.244,.043)
      *gaussian(Math.abs(x),.073,.079);
    const eyeZone=forward*gaussian(y,1.350,.053)
      *gaussian(Math.abs(x),.105,.084);
    const ci=i*3;
    // At rest the neutral bind face still has its authored child proportions.
    cheek[ci]=x+side*(.006*cheekZone+.0018*mouthZone);
    cheek[ci+1]=y+.010*cheekZone+.003*mouthZone;
    cheek[ci+2]=z-.0055*cheekZone-.0017*mouthZone;
    // Focus tightens the brow and raises the lower eyelid/cheek junction.
    focus[ci]=x-side*.0023*eyeZone;
    focus[ci+1]=y-.008*eyeZone+.003*cheekZone;
    focus[ci+2]=z-.0028*eyeZone;
  }
  const targets=[cheek,focus];
  const normals:THREE.BufferAttribute[]=[];
  for(const values of targets){
    const temp=new THREE.BufferGeometry();
    temp.setIndex(geo.index.clone());
    temp.setAttribute('position',new THREE.Float32BufferAttribute(values,3));
    temp.computeVertexNormals();
    normals.push((temp.getAttribute('normal') as THREE.BufferAttribute).clone());
    temp.dispose();
  }
  geo.morphAttributes.position=targets.map(values=>
    new THREE.Float32BufferAttribute(values,3));
  geo.morphAttributes.normal=normals;
  geo.morphTargetsRelative=false;
  face.updateMorphTargets();
  for(let i=0;i<RIDER_FACE_MORPHS.length;i++){
    face.morphTargetDictionary![RIDER_FACE_MORPHS[i]!]=i;
  }
  geo.computeBoundingSphere();
  if(geo.boundingSphere)geo.boundingSphere.radius+=.025;
}

export function poseRiderFaceMorphs(
  face:THREE.Mesh,cheekLift:number,alertFocus:number,
):void {
  const influence=face.morphTargetInfluences;
  if(!influence||influence.length<RIDER_FACE_MORPHS.length)return;
  const safe=(v:number,max:number):number=>
    Number.isFinite(v)?Math.max(0,Math.min(max,v)):0;
  influence[0]=safe(cheekLift,.42);
  influence[1]=safe(alertFocus,.55);
}
