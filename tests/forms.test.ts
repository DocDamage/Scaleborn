import { describe, expect, it } from 'vitest';
import { FORMS, FORM_LENGTHS_METERS } from '../src/actors/dragon/forms';
import { newFlightState, requestDragonForm, stepFlight, toggleLanding, type FlightControls } from '../src/actors/dragon/flight';
import { canStand, safeFlightY, coastalObstacles } from '../src/world/collision';
import { heightAt } from '../src/world/terrain';

const idle: FlightControls = { turn: 0, pitch: 0, bank: 0, boost: false, flap: false, move: 0 };
const land = () => {
  const s = newFlightState();
  s.x = -555; s.z = 100;
  s.y = heightAt(s.x, s.z) + 13;
  return s;
};

describe('three-form dragon contract', () => {
  it('respects the approved dog/horse/40-foot size progression', () => {
    expect(FORM_LENGTHS_METERS.small).toBeLessThan(1);
    expect(FORM_LENGTHS_METERS.rideable).toBeGreaterThan(3);
    expect(FORM_LENGTHS_METERS.giant).toBeGreaterThan(12);
    expect(FORMS.small.radius).toBeLessThan(FORMS.rideable.radius);
    expect(FORMS.rideable.radius).toBeLessThan(FORMS.giant.radius);
  });
  it('rejects unsafe midair dismount without mutating form', () => {
    const s = newFlightState();
    const result = requestDragonForm(s, 'small');
    expect(result.ok).toBe(false);
    expect(result.message).toContain('Land first');
    expect(s.form).toBe('rideable');
  });
  it('allows deliberate landing, shrinking, roaming and remounting when nearby', () => {
    const s = land();
    expect(canStand(s.x, s.z, 'rideable').ok).toBe(true);
    expect(toggleLanding(s).ok).toBe(true);
    expect(s.mode).toBe('ground');
    expect(s.transition?.phase).toBe('landing');
    for (let i = 0; i < 90; i++) stepFlight(s, idle, 1 / 60);
    expect(s.transition).toBeNull();
    expect(requestDragonForm(s, 'small').ok).toBe(true);
    expect(s.form).toBe('small');
    for (let i = 0; i < 15; i++) stepFlight(s, { ...idle, move: 1 }, 1 / 60);
    expect(s.y).toBeCloseTo(heightAt(s.x, s.z) + FORMS.small.standHeight, 5);
    expect(requestDragonForm(s, 'rideable').ok).toBe(true);
    expect(toggleLanding(s).ok).toBe(true);
    expect(s.mode).toBe('air');
  });
  it('keeps giant flight distinct and clears terrain/structures', () => {
    const s = newFlightState();
    s.y = 250;
    expect(requestDragonForm(s, 'giant').ok).toBe(true);
    expect(s.form).toBe('giant');
    for (let i = 0; i < 300; i++) stepFlight(s, { ...idle, pitch: -1, boost: true }, 1 / 60);
    expect(s.y).toBeGreaterThanOrEqual(safeFlightY(s.x, s.z, 'giant'));
    expect(s.speed).toBeGreaterThan(FORMS.rideable.cruise);
    expect(s.pitch).toBeGreaterThanOrEqual(-0.76);
  });
  it('rejects growth into low clearance and near authored structures', () => {
    const s = newFlightState();
    const obstacle = coastalObstacles().find((o) => o.id === 'lighthouse')!;
    s.x = obstacle.x; s.z = obstacle.z;
    s.y = obstacle.top - 3;
    expect(requestDragonForm(s, 'giant').ok).toBe(false);
    s.mode = 'ground';
    s.y = heightAt(s.x, s.z) + FORMS.rideable.standHeight;
    expect(requestDragonForm(s, 'giant').ok).toBe(false);
  });
  it('never lands on open water or from high altitude', () => {
    const sea = newFlightState();
    sea.x = 1900; sea.z = 1900; sea.y = 12;
    expect(toggleLanding(sea).ok).toBe(false);
    expect(sea.mode).toBe('air');
    const high = land(); high.y += 200;
    expect(toggleLanding(high).ok).toBe(false);
  });
  it('preserves time-step invariance for invalid deltas', () => {
    const s = newFlightState();
    const before = { ...s };
    stepFlight(s, idle, 0);
    stepFlight(s, idle, Infinity);
    stepFlight(s, idle, 0.3);
    expect(s).toEqual(before);
  });
});
