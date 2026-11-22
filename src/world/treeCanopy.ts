import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { rng } from '../core/random';

export const TREE_SPECIES = ['coastal-oak', 'silver-birch', 'shore-pine', 'river-alder'] as const;
export type TreeSpecies = 0 | 1 | 2 | 3;
export type FoliageQuality = 'high' | 'low';

interface TreeProfile {
  height: number;
  spread: number;
  trunkRadius: number;
  baseHeight: number;
  limbs: number;
  twigCount: number;
  foliageCount: number;
  inclination: number;
  droop: number;
}

const PROFILES: readonly TreeProfile[] = [
  // Low, broad crown; sturdy contorted branches.
  {height:12.2,spread:6.4,trunkRadius:.57,baseHeight:.32,limbs:18,
    twigCount:5,foliageCount:14,inclination:1.6,droop:.12},
  // High slender trunk, sparse upper crown, long drooping fine branches.
  {height:16.7,spread:3.8,trunkRadius:.35,baseHeight:.37,limbs:20,
    twigCount:4,foliageCount:13,inclination:1.15,droop:-.72},
  // Conical needle sprays on stepped horizontal branches.
  {height:18.6,spread:5.1,trunkRadius:.48,baseHeight:.16,limbs:54,
    twigCount:2,foliageCount:15,inclination:-.20,droop:-.18},
  // Rounded, uneven waterside crown with flexible hanging boughs.
  {height:13.3,spread:5.3,trunkRadius:.44,baseHeight:.25,limbs:22,
    twigCount:5,foliageCount:14,inclination:.80,droop:-.58},
];

export interface TreePrototype {
  wood: THREE.BufferGeometry;
  foliage: THREE.BufferGeometry;
  height: number;
  crownRadius: number;
  leafCards: number;
}

const WHITE = new THREE.Vector3(0, 1, 0);

function branchSegment(
  start: THREE.Vector3, end: THREE.Vector3,
  bottomRadius: number, endRadius: number, quality: FoliageQuality,
): THREE.BufferGeometry {
  const axis = end.clone().sub(start);
  const length = axis.length();
  if (length < .001) throw new Error('Degenerate branch segment');
  const geometry = new THREE.CylinderGeometry(
    endRadius, bottomRadius, length, quality === 'high' ? 7 : 5, 1,
  );
  geometry.applyQuaternion(new THREE.Quaternion().setFromUnitVectors(
    WHITE, axis.multiplyScalar(1 / length),
  ));
  geometry.translate(
    (start.x + end.x) * .5,
    (start.y + end.y) * .5,
    (start.z + end.z) * .5,
  );
  return geometry;
}

/** Original 2-by-2 painted atlas: oak, birch, needles and rounded alder. */
export function makeLeafAtlas(size = 128): THREE.DataTexture {
  if (!Number.isInteger(size) || size < 64 || size > 512 || size % 2 !== 0) {
    throw new Error('Leaf atlas dimensions must be even and 64..512');
  }
  const pixels = new Uint8Array(size * size * 4);
  const cell = size / 2;
  const palette: ReadonlyArray<readonly [number, number, number]> = [
    [153,181,123], [165,190,136], [109,160,135], [137,175,127],
  ];
  for (let species = 0; species < 4; species++) {
    const colors = palette[species]!;
    const offsetX = species % 2 * cell, offsetY = Math.floor(species / 2) * cell;
    for (let y = 0; y < cell; y++) for (let x = 0; x < cell; x++) {
      const u = 2 * (x + .5) / cell - 1;
      const v = 2 * (y + .5) / cell - 1;
      const mid = Math.abs(v);
      const edge = species === 2
        ? (.32+.038*Math.cos(v*24)) * Math.pow(Math.max(0, 1-mid*mid), .66)
        : species === 1
          ? .45 * Math.pow(Math.max(0, 1-mid*mid), .95) * (1-.12*v)
          : species === 0
            ? (.54 + .075*Math.cos(v*15))*Math.pow(Math.max(0,1-mid*mid),.57)
            : (.57+.045*Math.sin(v*22))*Math.pow(Math.max(0,1-mid*mid),.76);
      const feather = Math.max(0, Math.min(1, (edge-Math.abs(u))*cell*.62));
      const vein = Math.exp(-Math.abs(u) * (species===2 ? 32 : 12));
      const wash = Math.sin(u*11 + v*7 + species) * 4
        + Math.sin(v*29 + species*2.1) * 3;
      const idx = ((y+offsetY)*size+x+offsetX)*4;
      pixels[idx] = Math.max(0,Math.min(255,Math.round(colors[0]+vein*14+wash)));
      pixels[idx+1] = Math.max(0,Math.min(255,Math.round(colors[1]+vein*10+wash)));
      pixels[idx+2] = Math.max(0,Math.min(255,Math.round(colors[2]+vein*7+wash)));
      pixels[idx+3] = Math.round(feather*255);
    }
  }
  const texture = new THREE.DataTexture(pixels,size,size,THREE.RGBAFormat);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.wrapS = texture.wrapT = THREE.ClampToEdgeWrapping;
  texture.magFilter = THREE.LinearFilter;
  texture.minFilter = THREE.LinearMipmapLinearFilter;
  texture.generateMipmaps = true;
  texture.needsUpdate = true;
  return texture;
}

function appendLeaf(
  positions: number[], uvs: number[], species: TreeSpecies,
  base: THREE.Vector3, yaw: number, length: number, width: number,
  lift: number,
): void {
  const direction = new THREE.Vector3(Math.cos(yaw),lift,Math.sin(yaw)).normalize();
  // Rider-height captures exposed the problem with mostly horizontal leaf
  // planes: branches were visible, but foliage appeared as thin shards.
  // Broadly upright, differently tilted leaves remain readable from ground
  // level without making a single flat camera-facing billboard.
  const sideways = new THREE.Vector3(
    -Math.sin(yaw)*.64,.75+.15*Math.sin(yaw*1.7),
    Math.cos(yaw)*.64,
  ).normalize();
  // Use the entire textured quad. The old diamond-shaped pair of
  // triangles sampled only the centre of the alpha leaf, exposing thin
  // branches with small floating shards even when card counts increased.
  const bottom = base.clone().addScaledVector(direction,-length*.17);
  const top = base.clone().addScaledVector(direction,length*.83);
  const bL=bottom.clone().addScaledVector(sideways,-width);
  const bR=bottom.clone().addScaledVector(sideways,width);
  const tL=top.clone().addScaledVector(sideways,-width*.72);
  const tR=top.clone().addScaledVector(sideways,width*.72);
  const col = species % 2, row = Math.floor(species / 2);
  const uv = (u:number,v:number):void => {
    uvs.push((col+ .02 + u*.96)*.5,(row+.02+v*.96)*.5);
  };
  const add = (v:THREE.Vector3,u:number,t:number):void => {
    positions.push(v.x,v.y,v.z);
    uv(u,t);
  };
  add(bL,0,0); add(bR,1,0); add(tL,0,1);
  add(bR,1,0); add(tR,1,1); add(tL,0,1);
}

/**
 * Four genuinely different woody structures, not four random rotations of
 * the same tree. Branches are tapered, curves have intermediate joints and
 * leaves follow small seeded twig clusters. Built ONCE per archetype; forest
 * instances reuse the same vertex buffers and material.
 */
export function createTreePrototype(
  species: TreeSpecies, quality: FoliageQuality, seed: number,
): TreePrototype {
  const profile = PROFILES[species];
  if (!profile) throw new Error('Unknown tree species');
  const rand = rng(seed);
  const branchGeometries: THREE.BufferGeometry[] = [];
  const leafPositions: number[] = [], leafUv: number[] = [];
  const segments = 6;
  const leanAngle = rand()*Math.PI*2;
  const lean = species===3 ? .80 : species===1 ? .29 : .42;
  const stem: THREE.Vector3[] = [];
  for (let i=0;i<=segments;i++) {
    const t=i/segments;
    stem.push(new THREE.Vector3(
      Math.cos(leanAngle)*lean*t*t,
      profile.height*t,
      Math.sin(leanAngle)*lean*t*t,
    ));
    if (i===0) continue;
    branchGeometries.push(branchSegment(
      stem[i-1]!,stem[i]!,
      profile.trunkRadius*Math.pow(1-(i-1)/segments,.78)+.02,
      profile.trunkRadius*Math.pow(1-i/segments,.78)+.02,quality,
    ));
  }
  const proportion = quality==='high' ? 1 : .65;
  const count = quality==='high' ? profile.limbs : Math.round(profile.limbs*.78);
  for (let limb=0;limb<count;limb++) {
    const tier=species===2
      ? (Math.floor(limb/4)+.45)/Math.ceil(count/4)
      : (limb+.35)/count;
    const level=profile.baseHeight+(1-profile.baseHeight)*tier;
    const angle=(species===2?limb%4/4:limb*.61803398875)*Math.PI*2
      + (rand()-.5)*.48;
    const origin=stem[0]!.clone().lerp(stem[segments]!,level);
    const reach=profile.spread*(species===2
      ? Math.pow(Math.max(.04,1-tier),.76)
      : .70+.38*Math.sin(tier*Math.PI))
      *(.76+rand()*.45);
    const inclination=profile.inclination*(.53+.73*rand());
    const direction=new THREE.Vector3(Math.cos(angle),0,Math.sin(angle));
    const mid=origin.clone().addScaledVector(direction,reach*.49)
      .add(new THREE.Vector3(0,inclination*.58+(rand()-.5)*.35,0));
    const end=origin.clone().addScaledVector(direction,reach)
      .add(new THREE.Vector3(0,inclination+profile.droop+(rand()-.5)*.65,0));
    const majorRadius=profile.trunkRadius*(.23+.22*(1-tier));
    branchGeometries.push(branchSegment(origin,mid,majorRadius,majorRadius*.66,quality));
    branchGeometries.push(branchSegment(mid,end,majorRadius*.66,.025,quality));
    const countTwigs=profile.twigCount;
    for(let twig=0;twig<countTwigs;twig++){
      const location=.23+twig/countTwigs*.67;
      const start=mid.clone().lerp(end,location);
      const sideAngle=angle+(twig%2===0?1:-1)*(.28+rand()*.64);
      const length=(species===2?.65:1.28)*(0.7+rand()*.78);
      const tip=start.clone().add(new THREE.Vector3(
        Math.cos(sideAngle)*length,
        (species===1||species===3?-.52:.40)*(0.7+rand()),
        Math.sin(sideAngle)*length,
      ));
      if(quality==='high'||twig!==countTwigs-1) {
        branchGeometries.push(branchSegment(start,tip,.042,.009,quality));
      }
      const leaves=Math.max(4,Math.round(profile.foliageCount*proportion));
      for(let k=0;k<leaves;k++){
        const center=start.clone().lerp(tip,.36+rand()*.85);
        center.add(new THREE.Vector3(
          (rand()-.5)*(species===2?.47:1.18),
          (rand()-.5)*(species===2?.48:1.15),
          (rand()-.5)*(species===2?.47:1.18),
        ));
        const yaw=sideAngle+(rand()-.5)*Math.PI*2;
        appendLeaf(leafPositions,leafUv,species,center,yaw,
          (species===2?.88:.57)+rand()*(species===2?.60:.62),
          (species===2?.19:.23)+rand()*(species===2?.095:.27),
          species===2 ? .18+rand()*.32 : (rand()-.4)*.85);
      }
    }
    // Dense overlapping sprays along the full main-branch volume create
    // readable crowns from rider height. These are still individual painted
    // alpha-tested leaf cards, not spherical solid foliage blobs. Low uses a
    // bounded fraction to limit distant instanced triangle/alpha overdraw.
    const sprayCount=quality==='high'?3:2;
    const sprayLeaves=(quality==='high'?1:.65)*(species===2?8:10);
    for(let spray=0;spray<sprayCount;spray++){
      const anchor=mid.clone().lerp(end,.17+spray*.30);
      const spread=species===2?.82:1.35;
      const leaves=Math.round(sprayLeaves);
      for(let k=0;k<leaves;k++){
        const az=k*2.3999632297+rand()*.45+angle;
        const radius=Math.sqrt(rand())*spread;
        const center=anchor.clone().add(new THREE.Vector3(
          Math.cos(az)*radius,(rand()-.5)*spread*1.12,
          Math.sin(az)*radius,
        ));
        appendLeaf(leafPositions,leafUv,species,center,az+rand()*1.3,
          (species===2?.82:.78)+rand()*(species===2?.54:.64),
          (species===2?.22:.33)+rand()*(species===2?.11:.24),
          (rand()-.22)*.85);
      }
    }

    // Fill gaps close to the main limbs instead of a skeletal branch fan.
    if(species!==2)for(let k=0;k<(quality==='high'?22:13);k++){
      const center=mid.clone().lerp(end,.20+rand()*.8);
      center.add(new THREE.Vector3((rand()-.5)*1.25,(rand()-.5)*1.1,
        (rand()-.5)*1.25));
      appendLeaf(leafPositions,leafUv,species,center,angle+rand()*6.28,
        .52+rand()*.58,.21+rand()*.20,.12+rand()*.45);
    }
  }
  const wood=mergeGeometries(branchGeometries,false);
  branchGeometries.forEach(g=>g.dispose());
  if(!wood)throw new Error('Tree trunk/branch geometry could not be merged');
  const foliage=new THREE.BufferGeometry();
  foliage.setAttribute('position',new THREE.Float32BufferAttribute(leafPositions,3));
  foliage.setAttribute('uv',new THREE.Float32BufferAttribute(leafUv,2));
  foliage.computeVertexNormals();
  return {
    wood,foliage,height:profile.height,crownRadius:profile.spread,
    leafCards:leafPositions.length/18,
  };
}
