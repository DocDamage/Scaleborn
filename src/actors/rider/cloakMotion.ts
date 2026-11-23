import * as THREE from 'three';

/**
 * Lightweight wind and trailing-cloth movement for Scaleborn's original
 * young hybrid rider. The shoulder seam stays pinned to the existing rig.
 * All vertex memory is created once; runtime updates modify the same buffer.
 */
/** Optional render-only contact against Onyx's original dorsal sculpt. */
export interface RiderCloakContact {
  body: THREE.Object3D;
  /** Surface height in unscaled dragon body coordinates; null outside the torso. */
  surfaceY: (x:number,z:number)=>number|null;
}

export class RiderCloakMotion {
  private readonly mesh: THREE.Mesh;
  private readonly geometry: THREE.BufferGeometry;
  private readonly cloakToBody = new THREE.Matrix4();
  private readonly bodyToCloak = new THREE.Matrix4();
  private readonly vertex = new THREE.Vector3();
  private readonly position: THREE.BufferAttribute;
  private readonly rest: Float32Array;
  private readonly rows = 14;
  private readonly cols = 16;

  constructor(mesh: THREE.Mesh) {
    if (!(mesh?.geometry instanceof THREE.BufferGeometry)) {
      throw new Error('Rider cloak needs a buffer geometry');
    }
    this.mesh = mesh;
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

  update(time: number, speed: number, roll = 0,
    contact?: RiderCloakContact): void {
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
    // In mounted forms the hem lies above Onyx's curved dorsal surface,
    // rather than cutting through his back. Shoulder vertices remain pinned.
    if(contact)this.conformToBack(values,contact);
    this.position.needsUpdate = true;
    this.geometry.computeVertexNormals();
  }

  private conformToBack(values:Float32Array,contact:RiderCloakContact):void {
    const scale=contact.body.scale.x;
    if(!Number.isFinite(scale)||scale<=0)return;
    // Compute the change of basis once per frame, not once per vertex.
    // World transforms include the rider's spine/banking and Onyx's form.
    this.mesh.updateWorldMatrix(true,false);
    contact.body.updateWorldMatrix(true,false);
    this.cloakToBody.copy(contact.body.matrixWorld)
      .invert().multiply(this.mesh.matrixWorld);
    this.bodyToCloak.copy(this.cloakToBody).invert();
    const clearance=.045/scale;
    for(let row=1;row<=this.rows;row++){
      for(let col=0;col<=this.cols;col++){
        const i=(row*(this.cols+1)+col)*3;
        this.vertex.set(values[i]!,values[i+1]!,values[i+2]!)
          .applyMatrix4(this.cloakToBody);
        const surface=contact.surfaceY(this.vertex.x,this.vertex.z);
        if(surface===null||!Number.isFinite(surface)
          ||this.vertex.y>=surface+clearance)continue;
        // Adjust in dragon space, then invert to the original cloth's
        // rest-space. No pelvis/socket drift, allocations, or game physics.
        this.vertex.y=surface+clearance;
        this.vertex.applyMatrix4(this.bodyToCloak);
        values[i]=this.vertex.x;
        values[i+1]=this.vertex.y;
        values[i+2]=this.vertex.z;
      }
    }
  }
}
