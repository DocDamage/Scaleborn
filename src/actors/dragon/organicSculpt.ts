import * as THREE from 'three';
import { onyxSurfaceOffset, type OnyxSurfaceRegion } from './onyxSurfaceAnatomy';

/**
 * Original Onyx sculpting primitives: organically lofted silhouettes, not
 * SphereGeometry / ConeGeometry stacks. World units are metres. Sections are
 * authored in forward=-Z coordinates and smoothly interpolated by Catmull-Rom.
 */
export type SculptSection = readonly [
  z: number, centerY: number, radiusX: number, radiusY: number
];

function sampleSection(sections: readonly SculptSection[], t: number): SculptSection {
  const p = Math.max(0, Math.min(sections.length - 1.000001, t * (sections.length - 1)));
  const i = Math.floor(p), u = p - i;
  const a = sections[Math.max(0, i - 1)]!;
  const b = sections[i]!;
  const c = sections[Math.min(i + 1, sections.length - 1)]!;
  const d = sections[Math.min(i + 2, sections.length - 1)]!;
  const interpolate = (k: number): number => {
    const b0 = b[k]!, c0 = c[k]!;
    const m0 = (c0 - a[k]!) * .5;
    const m1 = (d[k]! - b0) * .5;
    return (2*u*u*u - 3*u*u + 1)*b0 + (u*u*u - 2*u*u + u)*m0
      + (-2*u*u*u + 3*u*u)*c0 + (u*u*u - u*u)*m1;
  };
  return [interpolate(0), interpolate(1), Math.max(.004, interpolate(2)),
    Math.max(.004, interpolate(3))];
}

/** Smooth anatomical surface with continuous texture UVs and subtle scales. */
export function loftDragon(sections: readonly SculptSection[],
  lengthSegments = 100, radialSegments = 32,
  region: OnyxSurfaceRegion = 'plain'): THREE.BufferGeometry {
  if (sections.length < 2) throw new Error('At least two body sections required');
  const points: number[] = [], uvs: number[] = [], colors: number[] = [];
  const breathing: number[] = [];
  const indices: number[] = [];
  for (let i = 0; i <= lengthSegments; i++) {
    const t = i / lengthSegments;
    const [z,cy,rx,ry] = sampleSection(sections, t);
    for (let j = 0; j <= radialSegments; j++) {
      const a = j / radialSegments * Math.PI * 2;
      const x = Math.cos(a), y = Math.sin(a);
      const ridge = Math.pow(Math.max(0, y), 12) * .025 * (1 - t);
      const pattern = .007 * Math.sin(a*16 + z*19)
        * Math.sin(a*8 - z*31);
      const offset = onyxSurfaceOffset(region, z, x, y);
      const px = x * (rx + pattern) + offset.x;
      const py = cy + y * (ry + pattern) + ridge + offset.y;
      points.push(px, py, z);
      if (region === 'torso') {
        // Inhalation gently broadens the ribcage under the shoulder and
        // saddle, without scaling the physics body or rider.
        const ribs = Math.exp(-Math.pow((z + .35) / .87, 2) * 2);
        breathing.push(px + x * .025 * ribs, py + y * .018 * ribs, z);
      }
      uvs.push(t*3.3, j/radialSegments*1.35);
      const violet = .5+.5*Math.sin(z*3.4+a*5);
      const dorsal = Math.max(0,y);
      colors.push(.74 + .16*violet*dorsal, .79 + .07*dorsal,
        .94 + .05*violet);
      if (i < lengthSegments && j < radialSegments) {
        const a0 = i*(radialSegments+1)+j, b0=a0+radialSegments+1;
        indices.push(a0,a0+1,b0,b0,a0+1,b0+1);
      }
    }
  }
  const geo = new THREE.BufferGeometry();
  geo.setIndex(indices);
  geo.setAttribute('position', new THREE.Float32BufferAttribute(points,3));
  geo.setAttribute('uv', new THREE.Float32BufferAttribute(uvs,2));
  geo.setAttribute('color', new THREE.Float32BufferAttribute(colors,3));
  if (region === 'torso') {
    geo.morphAttributes.position = [new THREE.Float32BufferAttribute(breathing, 3)];
  }
  geo.computeVertexNormals();
  return geo;
}

export const ONYX_TORSO: readonly SculptSection[] = [
  [-1.65,.23,.24,.25],
  [-1.46,.26,.34,.34],
  [-1.23,.24,.47,.44],
  [-.96,.15,.63,.55],
  [-.69,.065,.75,.65],
  [-.30,-.025,.84,.71],
  [.15,-.045,.85,.72],
  [.52,-.075,.76,.63],
  [.98,-.065,.60,.48],
  [1.38,-.08,.43,.36],
  [1.78,-.15,.29,.26],
  [2.24,-.18,.17,.16],
  [2.82,-.17,.08,.08],
  [3.19,-.13,.012,.018],
];

export const ONYX_HEAD: readonly SculptSection[] = [
  // A nearly closed nose tip and narrow wedge-shaped muzzle replace the
  // blunt open ellipse that gave Onyx a hippo-like profile in real WebGL.
  [-1.46,-.12,.008,.010],
  [-1.37,-.125,.145,.11],
  [-1.20,-.145,.27,.16],
  [-.98,-.145,.38,.22],
  [-.77,-.095,.48,.27],
  [-.54,.005,.58,.36],
  [-.31,.07,.62,.41],
  [-.11,.09,.61,.41],
  [.18,.10,.57,.38],
  [.43,.12,.41,.26],
  [.70,.08,.065,.055],
];

/**
 * Exact upper meridian of the SAME interpolated torso used in loftDragon.
 * Inverting its monotonic sculpt-z mapping prevents fins/ridges floating
 * above the tapered hips and tail base. Sampled only when constructing
 * geometry, never in the per-frame animation loop.
 */
export function onyxDorsalY(z: number): number {
  const first=ONYX_TORSO[0]![0];
  const last=ONYX_TORSO[ONYX_TORSO.length-1]![0];
  if(!Number.isFinite(z)||z<first||z>last){
    throw new Error('Onyx dorsal sample outside finite torso bounds');
  }
  let low=0,high=1;
  for(let i=0;i<28;i++){
    const t=(low+high)*.5;
    if(sampleSection(ONYX_TORSO,t)[0]<z)low=t;
    else high=t;
  }
  const t=(low+high)*.5;
  const [sampleZ,cy,,ry]=sampleSection(ONYX_TORSO,t);
  const a=Math.PI*.5;
  const pattern=.007*Math.sin(a*16+sampleZ*19)
    *Math.sin(a*8-sampleZ*31);
  const ridge=.025*(1-t);
  return cy+ry+pattern+ridge+onyxSurfaceOffset('torso',sampleZ,0,1).y;
}

/** Tapering tubular crests, curled horns, tail-fins, claws and tendrils. */
export function taperedSpine(
  points: readonly (readonly [number,number,number])[],
  baseRadius: number, sides=10, segments=34,
): THREE.BufferGeometry {
  if (points.length < 2 || baseRadius <= 0) throw new Error('Invalid curved spine');
  const curve = new THREE.CatmullRomCurve3(
    points.map(p => new THREE.Vector3(p[0],p[1],p[2])),false,'centripetal');
  const pos: number[]=[], uv: number[]=[], ids: number[]=[];
  const up=new THREE.Vector3(0,1,0), side=new THREE.Vector3(), second=new THREE.Vector3();
  for (let i=0;i<=segments;i++) {
    const t=i/segments, at=curve.getPoint(t), tangent=curve.getTangent(t);
    side.crossVectors(tangent,up).normalize();
    if (side.lengthSq()<.001) side.set(1,0,0);
    second.crossVectors(tangent,side).normalize();
    const radius=baseRadius*Math.pow(Math.max(.004,1-t),.8)
      * (1+.07*Math.sin(t*22));
    for(let j=0;j<=sides;j++) {
      const a=j/sides*Math.PI*2;
      const p=at.clone().addScaledVector(side,Math.cos(a)*radius)
        .addScaledVector(second,Math.sin(a)*radius);
      pos.push(p.x,p.y,p.z);uv.push(j/sides,t);
      if(i<segments&&j<sides){
        const n=i*(sides+1)+j,m=n+sides+1;
        ids.push(n,n+1,m,m,n+1,m+1);
      }
    }
  }
  const g=new THREE.BufferGeometry();
  g.setAttribute('position',new THREE.Float32BufferAttribute(pos,3));
  g.setAttribute('uv',new THREE.Float32BufferAttribute(uv,2));
  g.setIndex(ids);g.computeVertexNormals();
  return g;
}

/**
 * A leaflike cartilage fin, individually shaped with a soft camber, closed
 * tapered boundary and multiple real triangles. Used for Onyx's unmistakable
 * swept-back crests and split tail silhouette.
 */
export function sculptFin(
  base: readonly [number,number,number],
  tip: readonly [number,number,number],
  depth: number, material: THREE.Material,
  name: string, segments=18,
): THREE.Mesh {
  const b=new THREE.Vector3(...base), end=new THREE.Vector3(...tip);
  const positions: number[]=[], uv: number[]=[], indices: number[]=[];
  for(let i=0;i<=segments;i++){
    const t=i/segments;
    const center=b.clone().lerp(end,t);
    center.y+=Math.sin(Math.PI*t)*depth*.18;
    const width=depth*Math.sin(Math.PI*Math.pow(t,.8))*.5;
    // A central seam creates a curved two-sided surface instead of a card.
    for(let j=0;j<=2;j++){
      const v=j/2;
      positions.push(center.x + (v-.5)*width*.26,
        center.y + (1-Math.pow((v-.5)*2,2))*width*.17,
        center.z + (v-.5)*width*2.0);
      uv.push(t,v);
      if(i<segments&&j<2){
        const a=i*3+j,c=a+3;
        indices.push(a,c,a+1,c,c+1,a+1);
      }
    }
  }
  const geo=new THREE.BufferGeometry();
  geo.setIndex(indices);
  geo.setAttribute('position',new THREE.Float32BufferAttribute(positions,3));
  geo.setAttribute('uv',new THREE.Float32BufferAttribute(uv,2));
  geo.computeVertexNormals();
  const mesh=new THREE.Mesh(geo,material);
  mesh.name=name;
  return mesh;
}
