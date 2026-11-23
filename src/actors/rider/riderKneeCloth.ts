import * as THREE from 'three';

/**
 * Actual child-sized trouser cloth around the existing knee hinge. A static
 * GPU morph bunches the fabric above the bending knee without pulling on
 * the hip socket or separating the original knee/upper-leg silhouettes.
 * It shares the existing woven PBR material; no simulation or new garment.
 */
export function installRiderKneeClothMorph(trousers:THREE.Mesh):void {
  const geometry=trousers.geometry;
  const p=geometry.getAttribute('position');
  const uv=geometry.getAttribute('uv');
  if(!geometry.index||!p||!uv||p.count!==uv.count
      ||geometry.morphAttributes.position?.length){
    throw new Error('Rider trousers need an unmorphed indexed UV loft');
  }
  const values=new Float32Array(p.count*3);
  for(let i=0;i<p.count;i++){
    const x=p.getX(i),y=p.getY(i),z=p.getZ(i);
    const angle=uv.getX(i)*Math.PI*2;
    // Narrow creases just above the original knee hinge at local y=-.33.
    const knee=Math.exp(-2*Math.pow((y+.265)/.112,2));
    const bottom=Math.max(0,Math.min(1,(y+.355)/.030));
    const top=Math.max(0,Math.min(1,(-y-.025)/.075));
    const envelope=knee*bottom*top;
    const pleat=Math.cos(4*angle+1.1)*.0075*envelope;
    const tighten=1-.085*envelope*(.55+.45*Math.sin(angle));
    values[i*3]=x*tighten+Math.cos(angle)*pleat;
    values[i*3+1]=y+.005*envelope*Math.sin(angle*3-.6);
    values[i*3+2]=z+.008*envelope*Math.sin(angle*2+.8)
      +Math.sin(angle)*pleat;
  }
  geometry.morphAttributes.position=[
    new THREE.Float32BufferAttribute(values,3),
  ];
  const target=new THREE.BufferGeometry();
  target.setIndex(geometry.index.clone());
  target.setAttribute('position',new THREE.Float32BufferAttribute(values,3));
  target.computeVertexNormals();
  geometry.morphAttributes.normal=[
    (target.getAttribute('normal') as THREE.BufferAttribute).clone(),
  ];
  target.dispose();
  geometry.morphTargetsRelative=false;
  trousers.updateMorphTargets();
  geometry.computeBoundingSphere();
  if(geometry.boundingSphere) geometry.boundingSphere.radius+=.025;
}

/** Independent left/right animation can follow the existing knee channels. */
export function riderKneeClothInfluence(kneeBend:number):number {
  if(!Number.isFinite(kneeBend))return 0;
  const t=Math.min(1,Math.abs(kneeBend)/1.15);
  return t*t*(3-2*t);
}

export function poseRiderKneeCloth(trousers:THREE.Mesh,kneeBend:number):void {
  if(!trousers.morphTargetInfluences?.length)return;
  trousers.morphTargetInfluences[0]=riderKneeClothInfluence(kneeBend);
}
