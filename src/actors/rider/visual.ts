import * as THREE from 'three';
import { makeRiderContour, type RiderContour } from './contour';

function weaveTexture(): THREE.DataTexture {
  const size = 96;
  const pixels = new Uint8Array(size * size * 4);
  for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) {
    const thread = ((x % 4) < 2 ? 1 : -1) * ((y % 4) < 2 ? 1 : -1);
    const fiber = Math.sin(x * .73 + y * .17) * 4 + Math.cos(y * 1.12 - x * .23) * 3;
    const shade = Math.max(195, Math.min(249, 224 + thread * 9 + fiber));
    const i = (y * size + x) * 4;
    pixels[i] = shade;
    pixels[i + 1] = Math.min(255, shade + 3);
    pixels[i + 2] = Math.min(255, shade + 1);
    pixels[i + 3] = 255;
  }
  const texture = new THREE.DataTexture(pixels, size, size, THREE.RGBAFormat);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.wrapS = texture.wrapT = THREE.RepeatWrapping;
  texture.repeat.set(4, 4);
  texture.magFilter = THREE.LinearFilter;
  texture.minFilter = THREE.LinearMipmapLinearFilter;
  texture.generateMipmaps = true;
  texture.needsUpdate = true;
  return texture;
}

const clothWeave = weaveTexture();
const leather = new THREE.MeshStandardMaterial({
  color: 0x98705e, map: clothWeave, roughness: .88, metalness: 0,
});
const tunic = new THREE.MeshStandardMaterial({
  color: 0x477582, map: clothWeave, roughness: .92, metalness: 0,
});
const pants = new THREE.MeshStandardMaterial({
  color: 0x354e5d, map: clothWeave, roughness: .94, metalness: 0,
});
const skin = new THREE.MeshStandardMaterial({ color: 0xcba68b, roughness: .94 });
const hair = new THREE.MeshStandardMaterial({ color: 0x302a30, roughness: .87 });
const horn = new THREE.MeshStandardMaterial({ color: 0x4d565b, roughness: .67 });
const eye = new THREE.MeshStandardMaterial({ color: 0x263d3c, roughness: .48 });

function contour(parent: THREE.Object3D, name: string, material: THREE.Material,
  sections: RiderContour[], sides = 24): THREE.Mesh {
  const mesh = new THREE.Mesh(makeRiderContour(sections, sides), material);
  mesh.name = name;
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  parent.add(mesh);
  return mesh;
}
function oval(parent: THREE.Object3D, name: string, material: THREE.Material,
  xyz: [number, number, number], size: [number, number, number]): void {
  const mesh = new THREE.Mesh(new THREE.SphereGeometry(1, 24, 16), material);
  mesh.name = name;
  mesh.position.set(...xyz);
  mesh.scale.set(...size);
  mesh.castShadow = true;
  parent.add(mesh);
}

/** Silhouette-first, age-appropriate dragon-human rider with no pointed elf ears.
 * Logical limb sockets and size stay unchanged for dismount and future GLB swaps. */
export class RiderVisual {
  readonly group = new THREE.Group();
  private readonly capeGeometry = new THREE.BufferGeometry();
  private readonly capePositions: Float32Array;
  private readonly capeRows = 14;
  private readonly capeCols = 12;

  constructor() {
    const group = this.group;
    group.name = 'character.rider.hero';
    group.userData.assetId = group.name;
    contour(group, 'rider.torso', tunic, [
      { y: .47, x: 0, z: .09, radiusX: .20, radiusZ: .145 },
      { y: .56, x: 0, z: .08, radiusX: .24, radiusZ: .17 },
      { y: .79, x: 0, z: .04, radiusX: .205, radiusZ: .145 },
      { y: .95, x: 0, z: .00, radiusX: .245, radiusZ: .155 },
      { y: 1.10, x: 0, z: -.025, radiusX: .265, radiusZ: .16 },
      { y: 1.20, x: 0, z: -.045, radiusX: .115, radiusZ: .115 },
    ]);
    // Leather overlayer has a defined hem and shoulder line, not a featureless cube.
    contour(group, 'rider.coat', leather, [
      { y: .52, x: 0, z: .105, radiusX: .255, radiusZ: .18 },
      { y: .63, x: 0, z: .085, radiusX: .248, radiusZ: .18 },
      { y: .86, x: 0, z: .06, radiusX: .217, radiusZ: .156 },
      { y: 1.05, x: 0, z: .015, radiusX: .275, radiusZ: .172 },
      { y: 1.12, x: 0, z: -.01, radiusX: .248, radiusZ: .158 },
    ]);
    contour(group, 'rider.neck', skin, [
      { y: 1.14, x: 0, z: -.055, radiusX: .082, radiusZ: .087 },
      { y: 1.34, x: 0, z: -.067, radiusX: .086, radiusZ: .084 },
    ], 18);
    oval(group, 'rider.face', skin, [0, 1.43, -.065], [.206, .247, .205]);
    oval(group, 'rider.hair-crown', hair, [0, 1.588, -.01], [.216, .105, .222]);
    // Hair frames the temples; horn silhouettes communicate dragon ancestry.
    for (const side of [-1, 1] as const) {
      const suffix = side < 0 ? 'left' : 'right';
      oval(group, 'rider.hair-' + suffix, hair,
        [side * .179, 1.425, .055], [.050, .205, .143]);
      oval(group, 'rider.eye-' + suffix, eye,
        [side * .086, 1.458, -.253], [.036, .026, .018]);
      oval(group, 'rider.brow-' + suffix, hair,
        [side * .086, 1.513, -.246], [.059, .017, .015]);
      contour(group, 'rider.horn-' + suffix, horn, [
        { y: 1.63, x: side * .125, z: .018, radiusX: .074, radiusZ: .069 },
        { y: 1.73, x: side * .161, z: .028, radiusX: .058, radiusZ: .055 },
        { y: 1.83, x: side * .201, z: .067, radiusX: .034, radiusZ: .031 },
        { y: 1.91, x: side * .246, z: .106, radiusX: .005, radiusZ: .006 },
      ], 16);
      const arm = new THREE.Group();
      arm.name = 'rider.' + suffix + 'Arm';
      arm.position.set(side * .29, 1.07, -.01);
      contour(arm, 'rider.sleeve-' + suffix, leather, [
        { y: -.55, x: -side * .038, z: -.235, radiusX: .087, radiusZ: .090 },
        { y: -.41, x: -side * .03, z: -.177, radiusX: .087, radiusZ: .106 },
        { y: -.24, x: 0, z: -.108, radiusX: .105, radiusZ: .115 },
        { y: -.10, x: 0, z: -.042, radiusX: .114, radiusZ: .128 },
        { y: .035, x: 0, z: 0, radiusX: .134, radiusZ: .135 },
      ], 20);
      oval(arm, 'rider.hand-' + suffix, skin,
        [-side * .041, -.63, -.271], [.092, .112, .085]);
      group.add(arm);

      const leg = new THREE.Group();
      leg.name = 'rider.' + suffix + 'Leg';
      leg.position.set(side * .19, .55, .115);
      contour(leg, 'rider.trouser-' + suffix, pants, [
        { y: -.49, x: 0, z: -.035, radiusX: .109, radiusZ: .105 },
        { y: -.37, x: 0, z: .005, radiusX: .109, radiusZ: .114 },
        { y: -.23, x: 0, z: .09, radiusX: .130, radiusZ: .134 },
        { y: -.06, x: 0, z: .095, radiusX: .149, radiusZ: .146 },
        { y: .045, x: 0, z: .025, radiusX: .145, radiusZ: .145 },
      ], 20);
      oval(leg, 'rider.boot-' + suffix, horn,
        [0, -.514, -.165], [.124, .105, .242]);
      group.add(leg);
    }
    oval(group, 'rider.nose', skin, [0, 1.402, -.272], [.034, .051, .045]);

    const rows = this.capeRows, cols = this.capeCols;
    this.capePositions = new Float32Array((rows + 1) * (cols + 1) * 3);
    const uvs: number[] = [], indices: number[] = [];
    for (let i = 0; i <= rows; i++) for (let j = 0; j <= cols; j++) {
      uvs.push(j / cols, i / rows);
      if (i < rows && j < cols) {
        const a = i * (cols + 1) + j, b = a + 1, c = a + cols + 1;
        indices.push(a, c, b, b, c, c + 1);
      }
    }
    this.capeGeometry.setAttribute('position',
      new THREE.BufferAttribute(this.capePositions, 3).setUsage(THREE.DynamicDrawUsage));
    this.capeGeometry.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
    this.capeGeometry.setIndex(indices);
    // Stable bound prevents frustum popping when fabric moves; no per-frame allocation.
    this.capeGeometry.boundingSphere = new THREE.Sphere(new THREE.Vector3(0, .7, .42), 1.25);
    const cape = new THREE.Mesh(this.capeGeometry, new THREE.MeshStandardMaterial({
      color: 0x85624f, map: clothWeave, roughness: .93,
      side: THREE.DoubleSide, metalness: 0,
    }));
    cape.name = 'rider.cloak';
    cape.castShadow = true;
    group.add(cape);
    this.updateCape(0, 0);
  }

  /** Pinned shoulder seam, variable trailing folds and bounded wind billow. */
  updateCape(time: number, speed: number): void {
    const tSafe = Number.isFinite(time) ? time : 0;
    const wind = Math.min(.28, Math.max(0, Math.abs(Number.isFinite(speed) ? speed : 0) * .006));
    const rows = this.capeRows, cols = this.capeCols;
    let k = 0;
    for (let i = 0; i <= rows; i++) {
      const t = i / rows;
      const tip = t * t;
      for (let j = 0; j <= cols; j++) {
        const u = j / cols * 2 - 1;
        const fold = .023 * Math.sin(u * Math.PI * 4) * Math.sin(Math.PI * t);
        const flutter = Math.sin(tSafe * 3.4 - t * 7.3 + u * 4.1) *
          tip * (.018 + wind * .17);
        this.capePositions[k++] = u * (.195 + .21 * t) + flutter * .57;
        this.capePositions[k++] = 1.105 - .84 * t +
          tip * Math.sin(tSafe * 2.1 + u * 3.2) * wind * .14;
        this.capePositions[k++] = .165 + .29 * t + .08 * Math.sin(Math.PI * t) +
          fold + flutter + wind * .32 * tip;
      }
    }
    this.capeGeometry.getAttribute('position').needsUpdate = true;
    this.capeGeometry.computeVertexNormals();
  }
}
