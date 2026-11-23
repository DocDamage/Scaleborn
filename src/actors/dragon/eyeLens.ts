import * as THREE from 'three';

/**
 * Shallow, tapering original Onyx eye lens. A narrow corneal bulge follows the
 * skull instead of a protruding sphere, and the elongated corners preserve an
 * expressive reptilian eye at small and giant scale. The calling rig still
 * owns blinking, the pupil, and both standard eye socket names.
 */
export function makeOnyxEyeLens(parent: THREE.Group, side: -1 | 1,
  material: THREE.Material, pos:[number,number,number],
  scale:[number,number,number]): THREE.Mesh {
  const longitudinal=32,vertical=12;
  const points:number[]=[],uvs:number[]=[],indices:number[]=[];
  for(let i=0;i<=longitudinal;i++){
    const z=2*i/longitudinal-1;
    const corner=Math.max(0,1-z*z);
    const aperture=.013+.72*Math.pow(corner,.72);
    for(let j=0;j<=vertical;j++){
      const v=2*j/vertical-1;
      const bulge=.035+.26*corner*(1-v*v);
      points.push(side*bulge,v*aperture,z);
      uvs.push(i/longitudinal,j/vertical);
      if(i<longitudinal&&j<vertical){
        const k=i*(vertical+1)+j,n=k+vertical+1;
        if(side<0) indices.push(k,n,k+1,k+1,n,n+1);
        else indices.push(k,k+1,n,k+1,n+1,n);
      }
    }
  }
  const geometry=new THREE.BufferGeometry();
  geometry.setAttribute('position',new THREE.Float32BufferAttribute(points,3));
  geometry.setAttribute('uv',new THREE.Float32BufferAttribute(uvs,2));
  geometry.setIndex(indices);
  geometry.computeVertexNormals();
  const mesh=new THREE.Mesh(geometry,material);
  mesh.position.set(...pos);
  mesh.scale.set(...scale);
  parent.add(mesh);
  return mesh;
}
