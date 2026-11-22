import type { FlightState, InteractionResult } from '../actors/dragon/flight';
import { heightAt, LANDMARKS } from './terrain';
import { TIDEGATE, type TidegateState } from './tidegate';

export interface TidalEchoState {
  collected: boolean;
  attuned: boolean;
}

export type EchoPhase = 'locked' | 'seek-shrine' | 'return-to-gate' | 'complete';

const shrine = LANDMARKS.find((anchor) => anchor.id === 'azure.sunken-shrine');
if (!shrine) throw new Error('Tidal Echo requires the authored Sunken Shrine anchor');

/** The generated crystal's local center is y=10.3 above the terrain. */
export const ECHO_SHRINE = Object.freeze({
  id: 'azure.sunken-shrine.echo',
  x: shrine.x,
  z: shrine.z,
  heartY: heightAt(shrine.x, shrine.z) + 10.3,
  interactionRadius: 11,
  verticalRadius: 8.5,
  notificationRadius: 65,
});

const respond = (ok: boolean, message: string): InteractionResult => ({ ok, message });
const distance = (x: number, z: number, gx: number, gz: number): number =>
  Math.hypot(x - gx, z - gz);

export function newTidalEchoState(): TidalEchoState {
  return { collected: false, attuned: false };
}

export function echoPhase(state: TidalEchoState, gate: TidegateState): EchoPhase {
  if (!gate.solved) return 'locked';
  if (state.attuned) return 'complete';
  return state.collected ? 'return-to-gate' : 'seek-shrine';
}

export interface EchoObjective {
  phase: EchoPhase;
  title: string;
  instruction: string;
  x: number;
  z: number;
}

export function echoObjective(state: TidalEchoState, gate: TidegateState): EchoObjective {
  const phase = echoPhase(state, gate);
  if (phase === 'locked') return {
    phase, title: 'Awaken the Tidegate', instruction: 'Use both bonded companions to activate the two runestones.',
    x: TIDEGATE.rider.x, z: TIDEGATE.rider.z,
  };
  if (phase === 'seek-shrine') return {
    phase, title: 'Find the Tidal Echo', instruction: 'Dive to the Sunken Shrine and invoke its glowing heart as the dragon.',
    x: ECHO_SHRINE.x, z: ECHO_SHRINE.z,
  };
  if (phase === 'return-to-gate') return {
    phase, title: 'Attune the Echo', instruction: 'Return to Tidegate, dismount and let the rider invoke the right stone.',
    x: TIDEGATE.rider.x, z: TIDEGATE.rider.z,
  };
  return {
    phase, title: 'Tidal Accord Restored', instruction: 'The ancient bond between the dragon and rider has awakened.',
    x: TIDEGATE.rider.x, z: TIDEGATE.rider.z,
  };
}

export function echoShrineNearby(actor: FlightState): boolean {
  const x = actor.controlTarget === 'rider' ? actor.riderX : actor.x;
  const z = actor.controlTarget === 'rider' ? actor.riderZ : actor.z;
  return distance(x, z, ECHO_SHRINE.x, ECHO_SHRINE.z) <= ECHO_SHRINE.notificationRadius;
}

export function interactEchoShrine(
  state: TidalEchoState, gate: TidegateState, actor: FlightState,
): InteractionResult {
  if (actor.transition) return respond(false, 'Finish the current traversal maneuver first.');
  if (!gate.solved) return respond(false, 'The shrine is dormant. Awaken the two Tidegate runes first.');
  if (state.collected) return respond(true, 'The Tidal Echo already resonates with your dragon.');
  if (actor.controlTarget !== 'dragon' || actor.mode !== 'underwater') {
    return respond(false, 'Dive with your dragon to invoke the underwater crystal.');
  }
  if (distance(actor.x, actor.z, ECHO_SHRINE.x, ECHO_SHRINE.z) > ECHO_SHRINE.interactionRadius ||
    Math.abs(actor.y - ECHO_SHRINE.heartY) > ECHO_SHRINE.verticalRadius) {
    return respond(false, 'Swim closer to the glowing heart of the Sunken Shrine.');
  }
  state.collected = true;
  return respond(true, 'Tidal Echo recovered! Return to Tidegate with the young rider.');
}

export function attuneEchoAtGate(
  state: TidalEchoState, gate: TidegateState, actor: FlightState,
): InteractionResult {
  if (!gate.solved) return respond(false, 'The Tidegate runes must be awakened first.');
  if (state.attuned) return respond(true, 'The Tidal Accord is already restored.');
  if (!state.collected) return respond(false, 'The Sunken Shrine still holds the Tidal Echo.');
  if (actor.transition || actor.form !== 'small' || actor.controlTarget !== 'rider' ||
      actor.riderMode !== 'ground' || actor.mode !== 'ground') {
    return respond(false, 'Land, shrink your dragon, and let the rider attune the right runestone.');
  }
  if (distance(actor.riderX, actor.riderZ, TIDEGATE.rider.x, TIDEGATE.rider.z) >
      TIDEGATE.interactRadius) {
    return respond(false, 'The rider must stand beside the right Tidegate rune.');
  }
  state.attuned = true;
  return respond(true, 'Tidal Accord restored! Dragon and rider have completed the Echo Trial.');
}

export function validatedEchoState(state: TidalEchoState, gateSolved: boolean): TidalEchoState {
  if (!gateSolved) return newTidalEchoState();
  return { collected: state.collected || state.attuned, attuned: state.attuned };
}
