import * as THREE from 'three';
import { describe, expect, it } from 'vitest';
import { TidalEchoVisual } from '../src/world/tidalEchoVisual';
import { TidegateVisual } from '../src/world/tidegateVisual';
import { ECHO_SHRINE } from '../src/world/tidalEcho';

describe('Tidal Echo procedural scene adapters', () => {
  it('creates a positioned, code-authored shrine effect with independent ring materials', () => {
    const visual = new TidalEchoVisual();
    expect(visual.root.position.x).toBe(ECHO_SHRINE.x);
    expect(visual.root.position.y).toBe(ECHO_SHRINE.heartY);
    expect(visual.root.position.z).toBe(ECHO_SHRINE.z);
    const ring = visual.root.getObjectByName('echo.ring.0');
    expect(ring).toBeInstanceOf(THREE.Mesh);
    visual.update('locked', 0);
    const dormant = (ring as THREE.Mesh).material as THREE.MeshStandardMaterial;
    expect(dormant.emissiveIntensity).toBeLessThan(0.2);
    visual.update('seek-shrine', 2.25);
    expect(dormant.emissiveIntensity).toBeGreaterThan(0.9);
    visual.update('return-to-gate', 3.0);
    expect(dormant.opacity).toBeLessThan(0.3);
    visual.dispose();
  });
  it('distinguishes the completed land ritual through the existing beacon', () => {
    const gate = new TidegateVisual();
    const puzzle = { dragonAnchored: false, solved: true };
    const beacon = gate.root.getObjectByName('structure.azure.tidegate.beacon');
    expect(beacon).toBeDefined();
    const halo = beacon?.children.find((item) => item instanceof THREE.Mesh
      && item.geometry instanceof THREE.OctahedronGeometry) as THREE.Mesh | undefined;
    expect(halo).toBeInstanceOf(THREE.Mesh);
    gate.update(puzzle, 1, false);
    const material = halo!.material as THREE.MeshStandardMaterial;
    const before = material.emissive.getHex();
    gate.update(puzzle, 2, true);
    expect(material.emissive.getHex()).not.toBe(before);
    expect(material.emissiveIntensity).toBeGreaterThan(2);
  });
});
