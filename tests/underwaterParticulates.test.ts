import * as THREE from 'three';
import { describe, expect, it } from 'vitest';
import { GRAND_LAKE } from '../src/world/highlandLake';
import { underwaterOpticsAt } from '../src/world/underwaterOptics';
import { UnderwaterParticulates } from '../src/world/underwaterParticulates';

describe('camera-local underwater suspended particulate rendering', () => {
  it('batches stable world-locked cells at two render budgets', () => {
    const scene = new THREE.Scene();
    const low = new UnderwaterParticulates(scene, 'low');
    const high = new UnderwaterParticulates(scene, 'high');
    try {
      expect(low.points).toBeInstanceOf(THREE.Points);
      expect(low.points.geometry.getAttribute('position').count).toBe(13*9*13);
      expect(high.points.geometry.getAttribute('position').count).toBe(21*13*21);
      expect(low.points.frustumCulled).toBe(false);
      expect(low.points.material.depthWrite).toBe(false);
      expect(low.points.material.transparent).toBe(true);
      const shader = low.points.material.vertexShader;
      expect(shader).toContain('vec3 cell = position + uCameraCell');
      expect(shader).toContain('hash3(cell)');
      expect(shader).toContain('float lakeRadius');
      expect(shader).toContain('world.y >= uSurfaceY-.20');
      expect(low.points.material.fragmentShader).toContain('gl_PointCoord');
    } finally { low.dispose(); high.dispose(); }
    expect(scene.children).toHaveLength(0);
  });

  it('follows the real camera while preserving each world cell across frames', () => {
    const scene = new THREE.Scene();
    const field = new UnderwaterParticulates(scene, 'low');
    try {
      const position = new THREE.Vector3(GRAND_LAKE.x, GRAND_LAKE.surfaceY-7, GRAND_LAKE.z);
      const optics = underwaterOpticsAt(position.x, position.y, position.z, true);
      field.update(10, position, optics);
      const u = field.points.material.uniforms;
      expect(field.points.visible).toBe(true);
      expect(u.uLake?.value).toBe(1);
      expect(u.uSurfaceY?.value).toBe(GRAND_LAKE.surfaceY);
      const original = (u.uCameraCell!.value as THREE.Vector3).clone();
      field.update(11, position.clone().add(new THREE.Vector3(.05,0,0)), optics);
      expect(u.uCameraCell?.value).toEqual(original);
      field.update(12, position.clone().add(new THREE.Vector3(12,0,0)), optics);
      expect((u.uCameraCell!.value as THREE.Vector3).x).toBeGreaterThan(original.x);
      expect(u.uTime?.value).toBe(12);
      expect(u.uTransmission?.value).toBeGreaterThan(0);
    } finally { field.dispose(); }
  });

  it('hides the field in air and rejects non-finite camera coordinates', () => {
    const scene = new THREE.Scene();
    const field = new UnderwaterParticulates(scene, 'high');
    try {
      const camera = new THREE.Vector3(1600,-12,1600);
      field.update(2,camera,underwaterOpticsAt(camera.x,camera.y,camera.z,true));
      expect(field.points.visible).toBe(true);
      expect(field.points.material.uniforms.uLake?.value).toBe(0);
      expect(field.points.material.uniforms.uSurfaceY?.value).toBe(0);
      field.update(3,camera,underwaterOpticsAt(camera.x,camera.y,camera.z,false));
      expect(field.points.visible).toBe(false);
      field.update(4,new THREE.Vector3(Number.NaN,-3,0),
        underwaterOpticsAt(GRAND_LAKE.x,GRAND_LAKE.surfaceY-8,GRAND_LAKE.z,true));
      expect(field.points.visible).toBe(false);
    } finally { field.dispose(); }
    expect(scene.children).toHaveLength(0);
  });
});
