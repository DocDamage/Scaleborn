import * as THREE from 'three';

/**
 * Lightweight wind and trailing-cloth movement for Scaleborn's original
 * young hybrid rider. The shoulder seam stays pinned to the existing rig.
 * All vertex memory is created once; runtime updates modify the same buffer.
 */
export class RiderCloakMotion {
  private readonly geometry: THREE.BufferGeometry;
  private readonly position: THREE.BufferAttribute;
  private readonly rest: Float32Array;
  private readonly rows = 14;
  private readonly cols = 16;

  constructor(mesh: THREE.Mesh) {
    if (!(mesh?.geometry instanceof THREE.BufferGeometry)) {
      throw new Error('Rider cloak needs a buffer geometry');
    }
    this.geometry = mesh.geometry;
    const position = this.geometry.getAttribute('position');
    if (!(position instanceof THREE.BufferAttribute) ||
        position.itemSize !== 3 ||
        position.count !== (this.rows + 1) * (this.cols + 1)) {
      throw new Error('Unexpected Scaleborn cloak topology');
    }
    this.position = position;
    this.position.setUsage(THREE.DynamicDrawUsage);
    this.rest = new Float32Array(position.array);
  }

  update(time: number, speed: number, roll = 0): void {
    const t = Number.isFinite(time) ? time : 0;
    const wind = Math.min(.32, Math.max(0,
      Math.abs(Number.isFinite(speed) ? speed : 0) * .008));
    // Rider banking adds a restrained sideways crosswind; pinned shoulder
    // seams and stable local geometry remain unchanged.
    const bank = Math.max(-1,Math.min(1,Number.isFinite(roll)?roll:0));
    const values = this.position.array as Float32Array;
    for (let row = 0; row <= this.rows; row++) {
      const along = row / this.rows;
      const weight = along * along;
      for (let col = 0; col <= this.cols; col++) {
        const side = col / this.cols * 2 - 1;
        const i = (row * (this.cols + 1) + col) * 3;
        // Entire first row remains unchanged at the shoulders.
        const wave = Math.sin(t * 3.2 - along * 5.9 + side * 4.2);
        const pleat = Math.sin(side * Math.PI * 4 + t * 1.1);
        values[i] = this.rest[i]! +
          weight * (wave * (.009 + wind * .12) + bank * .086);
        values[i + 1] = this.rest[i + 1]! +
          weight * (Math.sin(t * 2.1 + side * 3.1) * (.008 + wind * .09)
            + wind * .12 - Math.abs(bank) * Math.abs(side) * .018);
        values[i + 2] = this.rest[i + 2]! +
          weight * (wave * (.012 + wind * .22) + pleat * .009
            + wind * .50 + bank * side * .025);
      }
    }
    this.position.needsUpdate = true;
    this.geometry.computeVertexNormals();
  }
}
