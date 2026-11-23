import * as THREE from 'three';
import { describe, expect, it, vi } from 'vitest';
import { GRAND_LAKE, MIRRORFALL, lakeContains } from '../src/world/highlandLake';
import { WATERFALL_DROP, waterfallCenterXAt } from '../src/world/waterfallTrajectory';
import { waterWaveOffsetAt } from '../src/world/waterWaves';
import { MirrorfallCascade } from '../src/world/mirrorfallCascade';
import { WATERFALL_FALL_SECONDS } from '../src/world/waterfallFallSpray';

const getInstances = (mesh: THREE.InstancedMesh): number[][] => {
  const matrix = new THREE.Matrix4();
  return Array.from({ length: mesh.count }, (_, i) => {
    mesh.getMatrixAt(i, matrix);
    return [...matrix.elements];
  });
};

describe('Mirrorfall gravity-timed curtain breakup', () => {
  it('matches the 114m fall and preserves the existing shared splash atlas', () => {
    expect(WATERFALL_FALL_SECONDS).toBeCloseTo(Math.sqrt(2 * WATERFALL_DROP / 9.81), 9);
    const cascade = new MirrorfallCascade('low');
    try {
      const fall = cascade.group.getObjectByName(
        'water.azure.mirrorfall-falling-droplet-threads') as THREE.InstancedMesh;
      const splash = cascade.group.getObjectByName(
        'water.azure.mirrorfall-ballistic-spray') as THREE.InstancedMesh;
      expect(fall).toBeInstanceOf(THREE.InstancedMesh);
      expect(fall.count).toBe(240);
      expect(fall.material).toBe(splash.material);
      expect(fall.geometry).not.toBe(splash.geometry);
      expect(fall.instanceMatrix.usage).toBe(THREE.DynamicDrawUsage);
      expect(fall.instanceColor?.count).toBe(fall.count);
      expect(fall.frustumCulled).toBe(false);
      expect(fall.renderOrder).toBeGreaterThan(3);
      expect(fall.renderOrder).toBeLessThan(3.5);
      expect(cascade.group.children.filter(o => o.name.includes('falling-droplet')))
        .toHaveLength(1);
    } finally { cascade.dispose(); }
  });

  it('follows the shared centerline, downwards with wave-safe impact retirement', () => {
    const cascade = new MirrorfallCascade('high');
    try {
      cascade.update(3.7);
      const fall = cascade.group.getObjectByName(
        'water.azure.mirrorfall-falling-droplet-threads') as THREE.InstancedMesh;
      expect(fall.count).toBe(540);
      const m = new THREE.Matrix4();
      const position = new THREE.Vector3();
      const scale = new THREE.Vector3();
      const rotation = new THREE.Quaternion();
      let visible = 0, lower = 0, downward = 0;
      for (let i = 0; i < fall.count; i++) {
        fall.getMatrixAt(i, m);
        m.decompose(position, rotation, scale);
        expect([...position.toArray(), ...scale.toArray()].every(Number.isFinite)).toBe(true);
        if (scale.lengthSq() < 1e-10) continue;
        visible++;
        expect(position.y).toBeLessThanOrEqual(MIRRORFALL.topY + .001);
        const drop = (MIRRORFALL.topY - position.y) / WATERFALL_DROP;
        expect(Math.abs(position.x - waterfallCenterXAt(drop))).toBeLessThan(5);
        expect(Math.abs(position.z - MIRRORFALL.z)).toBeLessThan(45);
        expect(position.y).toBeGreaterThan(
          GRAND_LAKE.surfaceY + waterWaveOffsetAt(position.x, position.z, 3.7) + .20);
        if (drop > .82) expect(lakeContains(position.x, position.z)).toBe(true);
        if (drop > .5) lower++;
        if (drop > .1 && new THREE.Vector3(0, 1, 0)
          .applyQuaternion(rotation).y < -.15) downward++;
      }
      expect(visible).toBeGreaterThan(350);
      expect(lower).toBeGreaterThan(70);
      expect(downward).toBeGreaterThan(200);
    } finally { cascade.dispose(); }
  });

  it('is independent of update order, ignores bad clock values and disposes geometry', () => {
    const a = new MirrorfallCascade('low');
    const b = new MirrorfallCascade('low');
    try {
      const meshA = a.group.getObjectByName(
        'water.azure.mirrorfall-falling-droplet-threads') as THREE.InstancedMesh;
      const meshB = b.group.getObjectByName(
        'water.azure.mirrorfall-falling-droplet-threads') as THREE.InstancedMesh;
      a.update(6.4); b.update(6.4);
      const initial = getInstances(meshA);
      expect(getInstances(meshB)).toEqual(initial);
      a.update(2.1); a.update(6.4);
      expect(getInstances(meshA)).toEqual(initial);
      a.update(NaN);
      // Cascade also runs a fixed-step splash loop; falling droplets remain
      // stable and don't inherit that integration clock.
      expect(getInstances(meshA)).toEqual(initial);
      const spy = vi.spyOn(meshA.geometry, 'dispose');
      a.dispose();
      expect(meshA.parent).toBe(null);
      expect(spy).toHaveBeenCalledTimes(1);
    } finally {
      // A has already disposed itself above; b still owns its resources.
      b.dispose();
    }
  });
});
