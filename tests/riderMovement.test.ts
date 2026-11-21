import { describe, expect, it } from 'vitest';
import { newFlightState, requestDragonForm, stepFlight, toggleLanding } from '../src/actors/dragon/flight';
import { toggleRiderControl, toggleRiderDive } from '../src/actors/rider/movement';
import { heightAt } from '../src/world/terrain';
import { RIDER_SURFACE_Y, riderFloorY } from '../src/world/waterPhysics';
const idle = { turn: 0, pitch: 0, bank: 0, boost: false, flap: false, move: 0 };
const land = () => {
  const s = newFlightState();
  s.x = -555; s.z = 100; s.y = heightAt(s.x, s.z) + 16; s.speed = 0;
  toggleLanding(s);
  for (let i = 0; i < 100; i++) stepFlight(s, idle, 1 / 60);
  requestDragonForm(s, 'small');
  return s;
};
describe('independent young dragonkin rider', () => {
  it('can switch focus to rider and return to dragon without changing either location', () => {
    const s = land();
    expect(s.form).toBe('small');
    expect(toggleRiderControl(s).ok).toBe(true);
    expect(s.controlTarget).toBe('rider');
    const x = s.x, riderX = s.riderX;
    for (let i = 0; i < 120; i++) stepFlight(s, { ...idle, move: 1 }, 1 / 60);
    expect(s.riderX !== riderX || s.riderZ !== s.z).toBe(true);
    expect(s.x).toBe(x);
    expect(toggleRiderControl(s).ok).toBe(true);
    expect(s.controlTarget).toBe('dragon');
  });
  it('requires proximity and solid land before remounting', () => {
    const s = land();
    toggleRiderControl(s);
    s.riderX += 20;
    expect(requestDragonForm(s, 'rideable').ok).toBe(false);
    s.riderX = s.x; s.riderZ = s.z;
    expect(requestDragonForm(s, 'rideable').ok).toBe(true);
    expect(s.controlTarget).toBe('dragon');
  });
  it('blocks rider switching when dragon is mounted', () => {
    const s = newFlightState();
    expect(toggleRiderControl(s).ok).toBe(false);
    expect(s.controlTarget).toBe('dragon');
  });
  it('allows magical breath-free swimming and respects the sea floor', () => {
    const s = land();
    s.riderX = 1900; s.riderZ = 1900;
    s.riderY = RIDER_SURFACE_Y; s.riderTargetY = RIDER_SURFACE_Y;
    s.riderMode = 'surface';
    expect(toggleRiderControl(s).ok).toBe(true);
    expect(toggleRiderDive(s).ok).toBe(true);
    for (let i = 0; i < 450; i++) stepFlight(s, { ...idle, bank: -1 }, 1 / 60);
    expect(s.riderY).toBeGreaterThanOrEqual(riderFloorY(s.riderX, s.riderZ) - 0.001);
    expect(s.riderMode).toBe('underwater');
    expect(toggleRiderDive(s).ok).toBe(true);
    for (let i = 0; i < 120; i++) stepFlight(s, idle, 1 / 60);
    expect(s.riderY).toBeCloseTo(RIDER_SURFACE_Y, 2);
  });
  it('does not grant unlimited underwater movement through terrain', () => {
    const s = land();
    s.riderX = -555; s.riderZ = 100;
    s.riderMode = 'ground';
    toggleRiderControl(s);
    expect(toggleRiderDive(s).ok).toBe(false);
    expect(s.riderMode).toBe('ground');
  });
});
