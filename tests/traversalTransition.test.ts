import { describe, expect, it } from 'vitest';
import { newFlightState, requestDragonForm, stepFlight, toggleLanding } from '../src/actors/dragon/flight';
import { FORMS } from '../src/actors/dragon/forms';
import { dragonPose } from '../src/actors/dragon/animationPose';
import { LANDING_DURATION, TAKEOFF_DURATION } from '../src/actors/dragon/traversalTransition';
import { heightAt } from '../src/world/terrain';

const empty = { turn: 0, pitch: 0, bank: 0, boost: false, flap: false, move: 0 };
const meadow = () => {
  const state = newFlightState();
  state.x = -555;
  state.z = 100;
  state.y = heightAt(state.x, state.z) + 18;
  return state;
};
const advance = (s: ReturnType<typeof newFlightState>, seconds: number) => {
  const count = Math.ceil(seconds * 60);
  for (let i = 0; i < count; i++) stepFlight(s, empty, 1 / 60);
};

describe('animated landing/takeoff transitions', () => {
  it('begins landing without teleporting and descends smoothly to standing height', () => {
    const s = meadow();
    const initialY = s.y;
    expect(toggleLanding(s).ok).toBe(true);
    expect(s.mode).toBe('ground');
    expect(s.transition?.phase).toBe('landing');
    expect(s.y).toBe(initialY);
    advance(s, 0.1);
    expect(s.y).toBeLessThan(initialY);
    expect(s.y).toBeGreaterThan(heightAt(s.x, s.z) + FORMS.rideable.standHeight);
    advance(s, LANDING_DURATION + 0.1);
    expect(s.transition).toBeNull();
    expect(s.y).toBeCloseTo(heightAt(s.x, s.z) + FORMS.rideable.standHeight, 5);
    expect(s.speed).toBe(0);
  });

  it('ascends smoothly before resuming regular assisted flight', () => {
    const s = meadow();
    toggleLanding(s);
    advance(s, LANDING_DURATION + 0.1);
    const yGround = s.y;
    expect(toggleLanding(s).ok).toBe(true);
    expect(s.mode).toBe('air');
    expect(s.transition?.phase).toBe('takingOff');
    expect(s.y).toBe(yGround);
    advance(s, 0.15);
    expect(s.y).toBeGreaterThan(yGround);
    const beforeDone = s.y;
    advance(s, TAKEOFF_DURATION + 0.1);
    expect(s.transition).toBeNull();
    expect(s.y).toBeGreaterThan(beforeDone);
    const initial = [s.x, s.z];
    advance(s, 0.5);
    expect([s.x, s.z]).not.toEqual(initial);
  });

  it('blocks concurrent traversal or shape changes during landing', () => {
    const s = meadow();
    toggleLanding(s);
    expect(toggleLanding(s).ok).toBe(false);
    expect(requestDragonForm(s, 'small').ok).toBe(false);
    advance(s, LANDING_DURATION + 0.1);
    expect(requestDragonForm(s, 'small').ok).toBe(true);
  });

  it('does not move laterally during either transition', () => {
    const s = meadow();
    const x = s.x, z = s.z;
    toggleLanding(s);
    const move = { ...empty, move: 1, turn: 1, boost: true };
    for (let i = 0; i < 80; i++) stepFlight(s, move, 1 / 60);
    advance(s, 0.2);
    expect(s.x).toBe(x);
    expect(s.z).toBe(z);
    toggleLanding(s);
    for (let i = 0; i < 65; i++) stepFlight(s, move, 1 / 60);
    expect(s.x).toBe(x);
    expect(s.z).toBe(z);
  });

  it('produces different procedural animation states for land, takeoff and walking', () => {
    const s = meadow();
    toggleLanding(s);
    expect(dragonPose(s).name).toBe('land');
    advance(s, LANDING_DURATION + 0.1);
    expect(dragonPose(s).name).toBe('rest');
    for (let i = 0; i < 5; i++) stepFlight(s, { ...empty, move: 1 }, 1 / 60);
    expect(dragonPose(s).name).toBe('walk');
    expect(dragonPose(s).gaitAmount).toBeGreaterThan(0);
    toggleLanding(s);
    expect(dragonPose(s).name).toBe('launch');
  });
});
