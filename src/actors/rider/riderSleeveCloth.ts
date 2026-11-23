import * as THREE from 'three';

/**
 * Original child-sized sleeve cloth deformation. A secondary GPU morph
 * tightens cloth inside elbow flexion and raises small asymmetric creases
 * behind the cuff. Geometry is authored once; the pose updates only one
 * morph influence and never edits positions or normals every frame.
 *
 * Both arms retain their named upper-arm/elbow/wrist bones and materials.
 */
export function installSleeveCreaseMorph(mesh:THREE.Mesh):void {
  const geometry=mesh.geometry;
  if(geometry.morphAttributes.position?.length){
    throw new Error('Sleeve already has a position morph');
  }
  const base=geometry.getAttribute('position');
  const uv=geometry.getAttribute('uv');
  if(!base||!uv||base.count!==uv.count){
    throw new Error('Sleeve requires indexed sculpt positions and matching UVs');
  }
  const values=new Float32Array(base.count*3);
  for(let i=0;i<base.count;i++){
    const x=base.getX(i),y=base.getY(i),z=base.getZ(i);
    const angle=uv.getX(i)*Math.PI*2;
    const nearElbow=Math.exp(-Math.pow((y+.30)/.115,2)*2);
    const fold=.0095*nearElbow*(.35+.65*Math.cos(3*angle+.35));
    // Fold circumference varies around the inner elbow rather than
    // creating one sharp, symmetrical tube or pulling the sleeve off-arm.
    const swell=.006*nearElbow*Math.cos(angle*5-1.2);
    const squeeze=1-.13*nearElbow*(.5+.5*Math.sin(angle));
    values[i*3]=x*squeeze+Math.cos(angle)*(fold+swell);
    values[i*3+1]=y+.0045*nearElbow*Math.sin(angle*2+.4);
    values[i*3+2]=z+Math.sin(angle)*(fold+swell);
  }
  geometry.morphAttributes.position=[
    new THREE.Float32BufferAttribute(values,3),
  ];
  // Supply correct shaded normals at full elbow bend, instead of keeping
  // the undeformed sleeve's normal field over the woven PBR maps.
  const foldGeometry=new THREE.BufferGeometry();
  foldGeometry.setAttribute('position',new THREE.Float32BufferAttribute(values,3));
  if(geometry.index)foldGeometry.setIndex(geometry.index.clone());
  foldGeometry.computeVertexNormals();
  geometry.morphAttributes.normal=[
    foldGeometry.getAttribute('normal').clone(),
  ];
  foldGeometry.dispose();
  geometry.morphTargetsRelative=false;
  mesh.updateMorphTargets();
  // The morph stays within original upper-arm limits; a conservative local
  // bound accounts for both the original and deformed cloth positions.
  geometry.computeBoundingSphere();
  if(geometry.boundingSphere)geometry.boundingSphere.radius+=.03;
}

/** Pure bounded bend-to-cloth influence, also used in GLB future adapter. */
export function sleeveCreaseInfluence(elbowBend:number):number {
  if(!Number.isFinite(elbowBend))return 0;
  const bend=Math.min(1,Math.abs(elbowBend)/1.2);
  return bend*bend*(3-2*bend);
}

export function poseSleeveCrease(mesh:THREE.Mesh,elbowBend:number):void {
  if(!mesh.morphTargetInfluences?.length)return;
  mesh.morphTargetInfluences[0]=sleeveCreaseInfluence(elbowBend);
}
