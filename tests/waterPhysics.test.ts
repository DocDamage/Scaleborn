import { describe, expect, it } from 'vitest';
import { newFlightState, stepFlight, toggleLanding } from '../src/actors/dragon/flight';
import { toggleDragonDive } from '../src/actors/dragon/swimming';
import { canDragonDive, canEnterSea, dragonBottomY, dragonSurfaceY, riderCanSwim, approach } from '../src/world/waterPhysics';
import { heightAt } from '../src/world/terrain';
import { waterWaveOffsetAt } from '../src/world/waterWaves';
const idle = { turn: 0, pitch: 0, bank: 0, boost: false, flap: false, move: 0 };
const sea = () => {
  const s = newFlightState(); s.x = 1900; s.z = 1900; s.y = 16; s.speed = 0; return s;
};
describe('deterministic air/sea integration', () => {
  it('approaches depth by a limited step without snapping', () => {
    expect(approach(-20, 0, 1)).toBe(-19);
    expect(approach(20, 0, 1)).toBe(19);
    expect(approach(-0.2, 0, 1)).toBe(0);
    expect(approach(0.2, 0, 1)).toBe(0);
  });
  it('distinguishes shallow shore from deep water and safe sea floor', () => {
    expect(canEnterSea(1900, 1900, 'rideable').ok).toBe(true);
    expect(canDragonDive(1900, 1900, 'rideable').ok).toBe(true);
    expect(canEnterSea(-555, 100, 'rideable').ok).toBe(false);
    expect(riderCanSwim(1900, 1900)).toBe(true);
    expect(dragonBottomY(1900, 1900, 'rideable')).toBeGreaterThan(heightAt(1900, 1900));
  });
  it('enters water without scene loading and completes a splashdown', () => {
    const s = sea();
    expect(toggleLanding(s).ok).toBe(true);
    expect(s.transition?.phase).toBe('splashdown');
    for (let i = 0; i < 90; i++) stepFlight(s, idle, 1 / 60);
    expect(s.mode).toBe('surface');
    expect(s.transition).toBeNull();
    // Height should follow the actual animated wave, not an obsolete flat plane.
    const movingSurface = dragonSurfaceY(s.form,s.x,s.z)
      + waterWaveOffsetAt(s.x,s.z,s.time)*.62;
    expect(Math.abs(s.y-movingSurface)).toBeLessThan(.9);
  });
  it('dives, respects seabed clearance and returns to surface', () => {
    const s = sea(); toggleLanding(s);
    for (let i = 0; i < 90; i++) stepFlight(s, idle, 1 / 60);
    expect(toggleDragonDive(s).ok).toBe(true);
    expect(s.mode).toBe('underwater');
    for (let i = 0; i < 360; i++) stepFlight(s, { ...idle, bank: -1 }, 1 / 60);
    expect(s.y).toBeGreaterThanOrEqual(dragonBottomY(s.x, s.z, s.form) - 0.001);
    expect(s.y).toBeLessThan(dragonSurfaceY(s.form));
    expect(toggleDragonDive(s).ok).toBe(true);
    for (let i = 0; i < 450; i++) stepFlight(s, idle, 1 / 60);
    expect(s.mode).toBe('surface');
    // Height should follow the actual animated wave, not an obsolete flat plane.
    const movingSurface = dragonSurfaceY(s.form,s.x,s.z)
      + waterWaveOffsetAt(s.x,s.z,s.time)*.62;
    expect(Math.abs(s.y-movingSurface)).toBeLessThan(.9);
  });
  it('requires surfacing before launch and leaves water without teleporting', () => {
    const s = sea(); toggleLanding(s);
    for (let i = 0; i < 90; i++) stepFlight(s, idle, 1 / 60);
    toggleDragonDive(s);
    expect(toggleLanding(s).ok).toBe(false);
    toggleDragonDive(s);
    for (let i = 0; i < 100; i++) stepFlight(s, idle, 1 / 60);
    const y = s.y;
    expect(toggleLanding(s).ok).toBe(true);
    expect(s.y).toBe(y);
    for (let i = 0; i < 120; i++) stepFlight(s, idle, 1 / 60);
    expect(s.mode).toBe('air');
    expect(s.y).toBeGreaterThan(10);
  });
  it('rejects sea entry above the allowed safe splash height', () => {
    const s = sea(); s.y = 150;
    expect(toggleLanding(s).ok).toBe(false);
    expect(s.mode).toBe('air');
  });
});
