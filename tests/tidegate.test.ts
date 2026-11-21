import { describe, expect, it } from 'vitest';
import { TidegateVisual } from '../src/world/tidegateVisual';
import * as THREE from 'three';
import { newFlightState, requestDragonForm, stepFlight, toggleLanding } from '../src/actors/dragon/flight';
import { toggleRiderControl } from '../src/actors/rider/movement';
import { TIDEGATE, newTidegateState, stepTidegate, interactTidegate, tidegateHint } from '../src/world/tidegate';
import { heightAt } from '../src/world/terrain';

const idle = { turn: 0, pitch: 0, bank: 0, boost: false, flap: false, move: 0 };
function getActors() {
  const s = newFlightState();
  s.x = TIDEGATE.dragon.x; s.z = TIDEGATE.dragon.z;
  s.y = heightAt(s.x, s.z) + 16;
  expect(toggleLanding(s).ok).toBe(true);
  for (let i = 0; i < 92; i++) stepFlight(s, idle, 1 / 60);
  expect(requestDragonForm(s, 'small').ok).toBe(true);
  return s;
}
describe('Tidegate dual-character rune puzzle', () => {
  it('constructs actual procedural rune meshes and updates the awakened beacon', () => {
    const visual = new TidegateVisual();
    const glyph = visual.root.getObjectByName('tidegate.dragon-glyph');
    expect(glyph).toBeInstanceOf(THREE.Mesh);
    const beacon = visual.root.getObjectByName('structure.azure.tidegate.beacon');
    expect(beacon).toBeDefined();
    visual.update({ dragonAnchored: true, solved: true }, 1.0);
    expect(visual.root.getObjectByName('tidegate.rider-glyph')).toBeDefined();
    const crystal = visual.root.getObjectByName('structure.azure.tidegate.beacon');
    expect(crystal?.children.some(child => child.visible)).toBe(true);
  });
  it('requires the right form and actor, never awards from mounted flight', () => {
    const p = newTidegateState();
    const s = newFlightState();
    expect(interactTidegate(p, s).ok).toBe(false);
    expect(p.solved).toBe(false);
    expect(p.dragonAnchored).toBe(false);
  });
  it('anchors the small dragon only on its own rune', () => {
    const p = newTidegateState(), s = getActors();
    s.x += 10;
    expect(interactTidegate(p, s).ok).toBe(false);
    s.x = TIDEGATE.dragon.x;
    expect(interactTidegate(p, s).ok).toBe(true);
    expect(p.dragonAnchored).toBe(true);
    expect(tidegateHint(p, s)).toContain('Tab');
  });
  it('requires a real rider interaction on the other rune', () => {
    const p = newTidegateState(), s = getActors();
    expect(interactTidegate(p, s).ok).toBe(true);
    expect(toggleRiderControl(s).ok).toBe(true);
    expect(interactTidegate(p, s).ok).toBe(false); // rider starts too far away
    s.riderX = TIDEGATE.rider.x;
    s.riderZ = TIDEGATE.rider.z;
    expect(interactTidegate(p, s).ok).toBe(true);
    expect(p.solved).toBe(true);
    expect(interactTidegate(p, s).message).toContain('already');
  });
  it('releases the rune if the dragon walks away before rider completes it', () => {
    const p = newTidegateState(), s = getActors();
    interactTidegate(p, s);
    s.x += 6;
    stepTidegate(p, s);
    expect(p.dragonAnchored).toBe(false);
    toggleRiderControl(s);
    s.riderX = TIDEGATE.rider.x;
    expect(interactTidegate(p, s).ok).toBe(false);
    expect(p.solved).toBe(false);
  });
  it('does not allow wet or mounted shortcuts', () => {
    const p = newTidegateState(), s = getActors();
    interactTidegate(p, s);
    toggleRiderControl(s);
    s.riderMode = 'underwater';
    s.riderX = TIDEGATE.rider.x;
    expect(interactTidegate(p, s).ok).toBe(false);
    s.riderMode = 'ground';
    s.riderX = TIDEGATE.rider.x;
    s.riderZ = TIDEGATE.rider.z;
    expect(interactTidegate(p, s).ok).toBe(true);
  });
});
