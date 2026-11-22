import * as THREE from 'three';
import type { DragonPose } from './animationPose';
import { makeWingMembraneTextures } from './wingMembrane';

/**
 * Original code-built deforming dragon wing.
 * Each wing has three actual skin bones and vertex weights, allowing a future
 * model swap to retain the logical leftWing/rightWing sockets.
 */
const membraneTextures = makeWingMembraneTextures();
const membraneMaterial = new THREE.MeshStandardMaterial({
  side: THREE.DoubleSide,
  vertexColors: true,
  metalness: 0.02,
  roughness: 1.0,
  map: membraneTextures.color,
  normalMap: membraneTextures.normal,
  normalScale: new THREE.Vector2(0.48, 0.48),
  roughnessMap: membraneTextures.roughness,
});
const sparMaterial = new THREE.MeshStandardMaterial({
  color: 0x3c6972, roughness: 0.63, metalness: 0.07,
});

export interface WingRig {
  root: THREE.Group;
  mesh: THREE.SkinnedMesh;
  shoulder: THREE.Bone;
  elbow: THREE.Bone;
  tip: THREE.Bone;
}

function spar(parent: THREE.Bone, length: number, side: -1 | 1): void {
  const rod = new THREE.Mesh(
    new THREE.CylinderGeometry(0.05, 0.11, length, 7), sparMaterial,
  );
  rod.position.x = side * length / 2;
  rod.rotation.z = -side * Math.PI / 2;
  parent.add(rod);
}

export function createWingRig(side: -1 | 1): WingRig {
  const root = new THREE.Group();
  root.name = side < 0 ? 'leftWing' : 'rightWing';
  root.position.set(side * 0.56, 0.40, -0.20);
  // A finely tessellated, cambered wing instead of a flat eleven-point fan.
  // Longitudinal edge stations preserve the distinctive scalloped silhouette.
  const leading: ReadonlyArray<readonly [number,number]> = [
    [0,-.11], [.65,-.54], [1.05,-.86], [2.45,-1.53], [3.20,-1.11], [3.97,-.71],
  ];
  const trailing: ReadonlyArray<readonly [number,number]> = [
    [0,.12], [.63,.77], [1.38,1.23], [2.16,.89],
    [2.77,1.25], [3.21,.60], [3.72,.19], [3.94,.64], [3.97,-.68],
  ];
  const sampleEdge=(stations:ReadonlyArray<readonly [number,number]>,x:number):number=>{
    for(let k=0;k<stations.length-1;k++){
      const a=stations[k]!,b=stations[k+1]!;
      if(x>b[0] && k<stations.length-2)continue;
      const t=Math.max(0,Math.min(1,(x-a[0])/(b[0]-a[0])));
      const eased=t*t*(3-2*t);
      return a[1]+(b[1]-a[1])*eased;
    }
    return stations[stations.length-1]![1];
  };
  const spanSteps=36, chordSteps=14, span=3.97;
  const vertices:number[]=[], colors:number[]=[], weights:number[]=[];
  const joints:number[]=[], triangles:number[]=[], uv:number[]=[];
  for(let i=0;i<=spanSteps;i++){
    const x=span*i/spanSteps, spread=i/spanSteps;
    const front=sampleEdge(leading,x),back=sampleEdge(trailing,x);
    for(let j=0;j<=chordSteps;j++){
      const chord=j/chordSteps;
      const scallop=Math.sin(Math.PI*spread);
      const camber=Math.sin(Math.PI*chord)*scallop*.19;
      const rib= Math.sin(chord*Math.PI*9+spread*3.4)*.016*scallop;
      const y=.02+.14*scallop+camber+rib;
      vertices.push(side*x,y,front+(back-front)*chord);
      uv.push(spread,chord);
      const pigment=.12+.07*spread+.035*(1-chord);
      colors.push(pigment,.26+.10*spread+.05*camber,.31+.12*spread);
      if(x<1.7){
        const t=x/1.7;
        joints.push(0,1,0,0);weights.push(1-t,t,0,0);
      } else {
        const t=Math.min(1,(x-1.7)/2.3);
        joints.push(1,2,0,0);weights.push(1-t,t,0,0);
      }
    }
  }
  const ring=chordSteps+1;
  for(let i=0;i<spanSteps;i++)for(let j=0;j<chordSteps;j++){
    const a=i*ring+j,b=a+1,c=a+ring,d=c+1;
    if(side>0)triangles.push(a,b,c,b,d,c);
    else triangles.push(a,c,b,b,c,d);
  }
  const geo=new THREE.BufferGeometry();
  geo.setIndex(triangles);
  geo.setAttribute('position',new THREE.Float32BufferAttribute(vertices,3));
  geo.setAttribute('uv',new THREE.Float32BufferAttribute(uv,2));
  geo.setAttribute('color',new THREE.Float32BufferAttribute(colors,3));
  geo.setAttribute('skinIndex',new THREE.Uint16BufferAttribute(joints,4));
  geo.setAttribute('skinWeight',new THREE.Float32BufferAttribute(weights,4));
  geo.computeVertexNormals();
  geo.computeBoundingSphere();

  const shoulder = new THREE.Bone();
  shoulder.name = side < 0 ? 'leftWing.shoulder' : 'rightWing.shoulder';
  const elbow = new THREE.Bone();
  elbow.position.set(side * 1.72, 0, -0.07);
  elbow.name = side < 0 ? 'leftWing.elbow' : 'rightWing.elbow';
  const tip = new THREE.Bone();
  tip.position.set(side * 1.55, 0, -0.02);
  tip.name = side < 0 ? 'leftWing.tip' : 'rightWing.tip';
  shoulder.add(elbow);
  elbow.add(tip);
  const mesh = new THREE.SkinnedMesh(geo, membraneMaterial);
  mesh.name = side < 0 ? 'wing.left.membrane' : 'wing.right.membrane';
  mesh.add(shoulder);
  mesh.updateMatrixWorld(true);
  mesh.bind(new THREE.Skeleton([shoulder, elbow, tip]));
  root.add(mesh);
  // The spars are thin animated bones, not detached decorative wing props.
  spar(shoulder, 1.6, side);
  spar(elbow, 1.5, side);
  spar(tip, 0.65, side);
  return { root, mesh, shoulder, elbow, tip };
}

/** Blend continuously between folded, launch, landing and cruise wing poses. */
export function poseWing(rig: WingRig, side: -1 | 1, pose: DragonPose): void {
  const phase = pose.flapPhase;
  const fold = Math.max(0, Math.min(1, pose.wingFold));
  const openShoulder = side * (0.11 + Math.sin(phase) * pose.flapAmount);
  const openElbow = side * (0.15 + Math.sin(phase - 0.55) * pose.flapAmount * 0.85);
  const openTip = side * (0.08 + Math.sin(phase - 1.0) * pose.flapAmount * 0.50);
  rig.shoulder.rotation.z = openShoulder * (1 - fold) - side * 0.76 * fold;
  rig.elbow.rotation.z = openElbow * (1 - fold) - side * 0.46 * fold;
  rig.tip.rotation.z = openTip * (1 - fold) - side * 0.22 * fold;
  rig.shoulder.rotation.x = Math.sin(phase + 0.3) * 0.065 * (1 - fold)
    + Math.sin(phase * 0.6) * 0.025 * fold;
}
