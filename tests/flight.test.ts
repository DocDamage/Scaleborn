import { describe, expect, it } from 'vitest';
import { newFlightState, stepFlight, type FlightControls } from '../src/actors/dragon/flight';
import { minimumFlightY } from '../src/world/terrain';

const idle: FlightControls = { turn: 0, pitch: 0, bank: 0, boost: false, flap: false };

describe('flight controller', () => {
  it('moves through the world without needing stamina', () => {
    const s = newFlightState();
    const initial = [s.x, s.y, s.z];
    for (let i = 0; i < 60 * 12; i++) stepFlight(s, idle, 1 / 60);
    expect([s.x, s.y, s.z]).not.toEqual(initial);
    expect(s.speed).toBeGreaterThan(45);
    expect(Number.isFinite(s.x)).toBe(true);
  });
  it('boosts faster and turns while respecting pitch limits', () => {
    const s = newFlightState();
    for (let i = 0; i < 150; i++) {
      stepFlight(s, { ...idle, turn: 1, pitch: 1, boost: true }, 1 / 60);
    }
    expect(s.speed).toBeGreaterThan(75);
    expect(s.yaw).toBeGreaterThan(1);
    expect(s.pitch).toBeLessThanOrEqual(0.78);
  });
  it('prevents the preview dragon from flying through terrain or the sea', () => {
    const s = newFlightState();
    for (let i = 0; i < 60 * 120; i++) {
      stepFlight(s, { ...idle, pitch: -1 }, 1 / 60);
      expect(s.y).toBeGreaterThanOrEqual(minimumFlightY(s.x, s.z) - 0.0001);
    }
  });
});
