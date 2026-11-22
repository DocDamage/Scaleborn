import * as THREE from 'three';
import type { DragonPose } from './animationPose';
import { makeWingMembraneMaterial } from './wingSurface';

/**
 * Original code-built deforming dragon wing.
 * Each wing has three deforming skin bones and dense curved membrane rows, allowing a future
 * model swap to retain the logical leftWing/rightWing sockets.
 */
const membraneMaterial = makeWingMembraneMaterial();
const sparMaterial = new THREE.MeshStandardMaterial({
  color: 0x504a79, roughness: 0.63, metalness: 0.07,
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
  const root=new THREE.Group();
  root.name=side<0?'leftWing':'rightWing';
  root.position.set(side*.56,.40,-.20);

  // Dense, organically curved membrane surface. Five broad finger-lobes
  // interrupt the rear edge rather than a single eleven-vertex triangle fan.
  // Three skeletal controls (shoulder/elbow/tip) deform every membrane row.
  const sections=80,chordSections=16;
  const vertices:number[]=[], uv:number[]=[], colors:number[]=[];
  const joints:number[]=[], weights:number[]=[], triangles:number[]=[];
  for(let i=0;i<=sections;i++) {
    const u=i/sections;
    const span=4.20*u;
    const edgeEnvelope=Math.pow(Math.max(0,Math.sin(Math.PI*(.04+.88*u))),.68);
    const fingerArc=Math.abs(Math.sin(Math.PI*u*4.7));
    const front=-.05-1.07*Math.sin(u*Math.PI*.85)-.18*u;
    const rear=.10+1.62*edgeEnvelope-.25*Math.pow(fingerArc,8);
    for(let j=0;j<=chordSections;j++){
      const v=j/chordSections;
      const z=front+(rear-front)*v;
      const camber=.19*Math.sin(Math.PI*v)*(1-u)
        +.08*Math.sin(u*Math.PI*2)*Math.sin(Math.PI*v);
      const crease=.025*Math.sin(v*23+u*35)*Math.sin(Math.PI*v);
      vertices.push(side*span,.07*Math.sin(Math.PI*u)+camber+crease,z);
      uv.push(u,v);
      const vein=Math.pow(Math.max(0,Math.cos(v*Math.PI*4.4+u*9.2)),18);
      const center=.44+.56*Math.sin(Math.PI*v);
      // Hand-painted violet iridescence and darker wing-finger striations.
      const dusk=.5+.5*Math.sin(u*10.8+v*16.3);
      colors.push((.16+.07*dusk+.045*vein)*center,
        (.23+.035*dusk+.04*vein)*center,
        (.44+.13*dusk+.09*vein)*center);
      if(u<=.43) {
        const t=u/.43;
        joints.push(0,1,0,0);weights.push(1-t,t,0,0);
      } else {
        const t=Math.min(1,(u-.43)/.57);
        joints.push(1,2,0,0);weights.push(1-t,t,0,0);
      }
      if(i<sections&&j<chordSections){
        const a=i*(chordSections+1)+j,b=a+chordSections+1;
        // Mirrored winding keeps the shaded normal facing the same physical
        // surface on both wings, instead of lighting the left wing inside-out.
        if(side>0) triangles.push(a,a+1,b,a+1,b+1,b);
        else triangles.push(a,b,a+1,a+1,b,b+1);
      }
    }
  }
  const geo=new THREE.BufferGeometry();
  geo.setIndex(triangles);
  geo.setAttribute('position',new THREE.Float32BufferAttribute(vertices,3));
  geo.setAttribute('uv',new THREE.Float32BufferAttribute(uv,2));
  geo.setAttribute('color',new THREE.Float32BufferAttribute(colors,3));
  geo.setAttribute('skinIndex',new THREE.Uint16BufferAttribute(joints,4));
  geo.setAttribute('skinWeight',new THREE.Float32BufferAttribute(weights,4));
  geo.computeVertexNormals();

  const shoulder=new THREE.Bone();
  shoulder.name=side<0?'leftWing.shoulder':'rightWing.shoulder';
  const elbow=new THREE.Bone();
  elbow.position.set(side*1.78,.04,-.13);
  elbow.name=side<0?'leftWing.elbow':'rightWing.elbow';
  const tip=new THREE.Bone();
  tip.position.set(side*1.66,-.03,.02);
  tip.name=side<0?'leftWing.tip':'rightWing.tip';
  shoulder.add(elbow);elbow.add(tip);
  const mesh=new THREE.SkinnedMesh(geo,membraneMaterial);
  mesh.name=side<0?'wing.left.membrane':'wing.right.membrane';
  mesh.frustumCulled=false; // Skeletal tip positions are outside bind-pose bounds.
  mesh.castShadow=true;mesh.receiveShadow=true;
  mesh.add(shoulder);
  mesh.updateMatrixWorld(true);
  mesh.bind(new THREE.Skeleton([shoulder,elbow,tip]));
  root.add(mesh);

  // Vein spars are attached to deforming bones and kept narrow enough to
  // preserve the arched painted-skin silhouette in flight and landing.
  spar(shoulder,1.65,side);
  spar(elbow,1.63,side);
  spar(tip,.72,side);
  return {root,mesh,shoulder,elbow,tip};
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
