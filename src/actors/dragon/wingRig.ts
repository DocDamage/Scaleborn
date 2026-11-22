import * as THREE from 'three';
import type { DragonPose } from './animationPose';
import { makeWingMembraneMaterial } from './wingSurface';
import { taperedSpine } from './organicSculpt';

/**
 * Original code-built deforming dragon wing.
 * Each wing has three deforming skin bones and dense curved membrane rows, allowing a future
 * model swap to retain the logical leftWing/rightWing sockets.
 */
const membraneMaterial = makeWingMembraneMaterial();
const sparMaterial = new THREE.MeshStandardMaterial({
  color: 0x292e4b, roughness: 0.78, metalness: 0.025,
});

export interface WingMembraneSection {
  front: number;
  rear: number;
  chord: number;
}

/**
 * Hand-authored anatomical outline for Onyx's original wing:
 * curved leading edge, five visible trailing finger bays and a true
 * tapered tip. All joins are smooth and keep positive chord length.
 */
export function wingMembraneSectionAt(spanFraction:number):WingMembraneSection {
  if(!Number.isFinite(spanFraction))throw new Error('Wing span must be finite');
  const u=Math.max(0,Math.min(1,spanFraction));
  const front=-.05-1.07*Math.sin(u*Math.PI*.85)-.18*u;
  const envelope=Math.pow(Math.max(0,
    Math.sin(Math.PI*(.04+.88*u))),.68);
  const scallopPhase=2*Math.PI*(5*u+.07);
  const scallop=Math.pow(.5+.5*Math.cos(scallopPhase),8);
  const bayStrength=Math.min(1,Math.max(0,(u-.09)/.15));
  const tipFraction=Math.max(0,Math.min(1,(u-.84)/.16));
  const tipSmooth=tipFraction*tipFraction*(3-2*tipFraction);
  const taper=1-tipSmooth;
  const chord=.031 + (1.96*envelope - .89*envelope*scallop*bayStrength)
    *taper;
  return {front,rear:front+chord,chord};
}

export interface WingRig {
  root: THREE.Group;
  mesh: THREE.SkinnedMesh;
  shoulder: THREE.Bone;
  elbow: THREE.Bone;
  tip: THREE.Bone;
}

/**
 * An original, tapered phalange follows the wing's cartilage leading edge.
 * The existing Bone owns its bend and all attachment names remain unchanged.
 * Curved lofts replace straight 7-sided cylinders with hard end caps.
 */
function spar(parent: THREE.Bone, length: number, side: -1 | 1,
  radius: number, index: number): void {
  const points: Array<readonly [number, number, number]> = [
    [0, 0, 0],
    [side * length * .23, .042, -.023],
    [side * length * .55, .082, -.075],
    [side * length * .83, .032, -.13],
    [side * length, -.024, -.16],
  ];
  const mesh = new THREE.Mesh(
    taperedSpine(points, radius, 14, 34), sparMaterial);
  mesh.name='creature.dragon.wing-finger.'+index;
  // Preserve outward-sided attachment semantics for legacy authored rigs.
  mesh.position.x=side*.006;
  mesh.castShadow=true;
  parent.add(mesh);
}

/** Exposed musculature blends each wing into the scapula and ribs. */
function rootTendon(side:-1|1):THREE.Mesh {
  const mesh=new THREE.Mesh(taperedSpine([
    [-side*.23,-.105,.22],
    [-side*.08,-.015,.11],
    [side*.18,.09,-.01],
    [side*.39,.135,-.095],
    [side*.61,.095,-.17],
  ],.205,16,40),sparMaterial);
  mesh.name=side<0?'creature.dragon.wing-root.left'
    :'creature.dragon.wing-root.right';
  mesh.castShadow=true;
  mesh.receiveShadow=true;
  return mesh;
}

export function createWingRig(side: -1 | 1): WingRig {
  const root=new THREE.Group();
  root.name=side<0?'leftWing':'rightWing';
  root.position.set(side*.56,.40,-.20);
  root.add(rootTendon(side));

  // Dense, organically curved membrane surface. Five broad finger-lobes
  // interrupt the rear edge rather than a single eleven-vertex triangle fan.
  // Three skeletal controls (shoulder/elbow/tip) deform every membrane row.
  const sections=80,chordSections=16;
  const vertices:number[]=[], foldedVertices:number[]=[];
  const uv:number[]=[], colors:number[]=[];
  const joints:number[]=[], weights:number[]=[], triangles:number[]=[];
  for(let i=0;i<=sections;i++) {
    const u=i/sections;
    const span=4.20*u;
    const {front,rear}=wingMembraneSectionAt(u);
    for(let j=0;j<=chordSections;j++){
      const v=j/chordSections;
      const z=front+(rear-front)*v;
      const camber=.19*Math.sin(Math.PI*v)*(1-u)
        +.08*Math.sin(u*Math.PI*2)*Math.sin(Math.PI*v);
      // Taper the depth of sculpted wing arches toward each narrow fingertip.
      const endTaper=.10+.90*Math.sin(Math.PI*Math.min(.999,u));
      const crease=.025*Math.sin(v*23+u*35)*Math.sin(Math.PI*v);
      const y=.07*Math.sin(Math.PI*u)+camber*endTaper+crease*endTaper;
      vertices.push(side*span,y,z);
      // A folded wing is a narrow pleated membrane wrapped against its
      // curved fingers, NOT the wide triangular sail seen in real QA.
      // Absolute morph position stays in the existing three-bone bind space.
      const pleat=Math.sin(v*Math.PI*8)*Math.sin(u*Math.PI)*.042;
      const foldedChord=.18*v
        +.003*Math.sin(v*Math.PI*6)*Math.sin(u*Math.PI);
      foldedVertices.push(side*span,y+pleat,front+(rear-front)*foldedChord);
      uv.push(u,v);
      const vein=Math.pow(Math.max(0,Math.cos(v*Math.PI*4.4+u*9.2)),18);
      const center=.44+.56*Math.sin(Math.PI*v);
      // Hand-painted violet iridescence and darker wing-finger striations.
      const dusk=.5+.5*Math.sin(u*10.8+v*16.3);
      // Midnight navy wing pigment with gentle violet iridescence, not
      // large opaque lavender sails. Painted material still supplies veins.
      colors.push((.15+.05*dusk+.03*vein)*center,
        (.22+.05*dusk+.03*vein)*center,
        (.35+.09*dusk+.06*vein)*center);
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
  geo.morphAttributes.position=[
    new THREE.Float32BufferAttribute(foldedVertices,3),
  ];
  // Correct shading at full fold, without per-frame normal recomputation.
  const foldNormals=new THREE.BufferGeometry();
  foldNormals.setIndex(triangles);
  foldNormals.setAttribute('position',new THREE.Float32BufferAttribute(foldedVertices,3));
  foldNormals.computeVertexNormals();
  geo.morphAttributes.normal=[foldNormals.getAttribute('normal').clone()];
  foldNormals.dispose();

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
  mesh.updateMorphTargets();
  mesh.name=side<0?'wing.left.membrane':'wing.right.membrane';
  mesh.frustumCulled=false; // Skeletal tip positions are outside bind-pose bounds.
  mesh.castShadow=true;mesh.receiveShadow=true;
  mesh.add(shoulder);
  mesh.updateMatrixWorld(true);
  mesh.bind(new THREE.Skeleton([shoulder,elbow,tip]));
  root.add(mesh);

  // Vein spars are attached to deforming bones and kept narrow enough to
  // preserve the arched painted-skin silhouette in flight and landing.
  spar(shoulder,1.65,side,.145,0);
  spar(elbow,1.63,side,.108,1);
  spar(tip,.72,side,.072,2);
  return {root,mesh,shoulder,elbow,tip};
}

/** Blend continuously between folded, launch, landing and cruise wing poses. */
export function poseWing(rig: WingRig, side: -1 | 1, pose: DragonPose): void {
  const phase = pose.flapPhase;
  const fold = Math.max(0, Math.min(1, pose.wingFold));
  const pleat=fold*fold*(3-2*fold);
  if (rig.mesh.morphTargetInfluences) {
    rig.mesh.morphTargetInfluences[0]=pleat;
  }
  const openShoulder = side * (0.11 + Math.sin(phase) * pose.flapAmount);
  const openElbow = side * (0.15 + Math.sin(phase - 0.55) * pose.flapAmount * 0.85);
  const openTip = side * (0.08 + Math.sin(phase - 1.0) * pose.flapAmount * 0.50);
  // Hinge the phalanges backward along Onyx's torso when grounded.
  // Pure downward rotation previously made long wings dangle through terrain.
  rig.shoulder.rotation.y = -side * 1.02 * fold;
  rig.elbow.rotation.y = -side * .43 * fold;
  rig.tip.rotation.y = -side * .21 * fold;
  rig.shoulder.rotation.z = openShoulder * (1 - fold) - side * .31 * fold;
  rig.elbow.rotation.z = openElbow * (1 - fold) - side * .24 * fold;
  rig.tip.rotation.z = openTip * (1 - fold) - side * .12 * fold;
  rig.shoulder.rotation.x = Math.sin(phase + 0.3) * 0.065 * (1 - fold)
    + Math.sin(phase * 0.6) * 0.025 * fold;
}
