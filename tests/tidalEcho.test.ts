import { describe, expect, it } from 'vitest';
import { newFlightState } from '../src/actors/dragon/flight';
import { newTidegateState } from '../src/world/tidegate';
import {
  ECHO_SHRINE, newTidalEchoState, echoPhase, echoObjective,
  interactEchoShrine, attuneEchoAtGate, echoShrineNearby, validatedEchoState,
} from '../src/world/tidalEcho';
import { TIDEGATE } from '../src/world/tidegate';

function submergedDragon() {
  const actor = newFlightState();
  actor.x = ECHO_SHRINE.x;
  actor.z = ECHO_SHRINE.z;
  actor.y = ECHO_SHRINE.heartY;
  actor.mode = 'underwater';
  actor.controlTarget = 'dragon';
  actor.transition = null;
  return actor;
}

describe('Tidal Echo multi-biome bonding quest', () => {
  it('requires the previous two-actor Tidegate achievement', () => {
    const gate = newTidegateState();
    const echo = newTidalEchoState();
    const actor = submergedDragon();
    expect(echoPhase(echo, gate)).toBe('locked');
    expect(echoObjective(echo, gate).title).toContain('Tidegate');
    expect(interactEchoShrine(echo, gate, actor).ok).toBe(false);
    expect(echo.collected).toBe(false);
    gate.solved = true;
    expect(echoPhase(echo, gate)).toBe('seek-shrine');
  });
  it('requires real underwater 3D proximity and the dragon to recover the Echo', () => {
    const gate = { dragonAnchored: true, solved: true };
    const echo = newTidalEchoState(), actor = submergedDragon();
    actor.mode = 'surface';
    expect(interactEchoShrine(echo, gate, actor).ok).toBe(false);
    actor.mode = 'underwater';
    actor.x += ECHO_SHRINE.interactionRadius + 1;
    expect(interactEchoShrine(echo, gate, actor).ok).toBe(false);
    actor.x = ECHO_SHRINE.x;
    actor.y += ECHO_SHRINE.verticalRadius + 1;
    expect(interactEchoShrine(echo, gate, actor).ok).toBe(false);
    actor.y = ECHO_SHRINE.heartY;
    actor.controlTarget = 'rider';
    expect(interactEchoShrine(echo, gate, actor).ok).toBe(false);
    actor.controlTarget = 'dragon';
    expect(echoShrineNearby(actor)).toBe(true);
    expect(interactEchoShrine(echo, gate, actor).ok).toBe(true);
    expect(echo.collected).toBe(true);
    expect(echoObjective(echo, gate).phase).toBe('return-to-gate');
  });
  it('requires the rider, dry ground and the right Tidegate rune to attune', () => {
    const gate = { dragonAnchored: true, solved: true };
    const echo = { collected: true, attuned: false };
    const actor = submergedDragon();
    expect(attuneEchoAtGate(echo, gate, actor).ok).toBe(false);
    actor.form = 'small';
    actor.mode = 'ground';
    actor.controlTarget = 'rider';
    actor.riderMode = 'surface';
    expect(attuneEchoAtGate(echo, gate, actor).ok).toBe(false);
    actor.riderMode = 'ground';
    actor.riderX = TIDEGATE.rider.x + 20;
    actor.riderZ = TIDEGATE.rider.z;
    expect(attuneEchoAtGate(echo, gate, actor).ok).toBe(false);
    actor.riderX = TIDEGATE.rider.x;
    expect(attuneEchoAtGate(echo, gate, actor).ok).toBe(true);
    expect(echo.attuned).toBe(true);
    expect(echoPhase(echo, gate)).toBe('complete');
    expect(echoObjective(echo, gate).title).toBe('Tidal Accord Restored');
    expect(attuneEchoAtGate(echo, gate, actor).message).toContain('already');
  });
  it('does not allow a forged quest state to bypass the Tidegate', () => {
    expect(validatedEchoState({ collected: true, attuned: true }, false))
      .toEqual({ collected: false, attuned: false });
    expect(validatedEchoState({ collected: false, attuned: true }, true))
      .toEqual({ collected: true, attuned: true });
  });
});
