import type { FlightState, InteractionResult } from '../actors/dragon/flight';

export const TIDEGATE = Object.freeze({
  id: 'azure.tidegate',
  name: 'Tidegate Runestones',
  dragon: { x: -555, z: 100 },
  rider: { x: -551.6, z: 100 },
  interactRadius: 1.55,
  approachRadius: 36,
});

export interface TidegateState {
  dragonAnchored: boolean;
  solved: boolean;
}

export function newTidegateState(): TidegateState {
  return { dragonAnchored: false, solved: false };
}

function near(x: number, z: number, point: {x: number; z: number}, radius: number): boolean {
  return Math.hypot(x - point.x, z - point.z) <= radius;
}

/** Release an unsolved rune if the dragon changes size or leaves its stone. */
export function stepTidegate(puzzle: TidegateState, actor: FlightState): void {
  if (puzzle.solved || !puzzle.dragonAnchored) return;
  if (actor.form !== 'small' || actor.mode !== 'ground' ||
    !near(actor.x, actor.z, TIDEGATE.dragon, TIDEGATE.interactRadius)) {
    puzzle.dragonAnchored = false;
  }
}

const result = (ok: boolean, message: string): InteractionResult => ({ ok, message });

/**
 * Both characters perform real actions: small dragon anchors the first stone,
 * and the dismounted rider invokes the second. A one-character shortcut fails.
 * This state is session-only until milestone G5 save-system integration.
 */
export function interactTidegate(puzzle: TidegateState, actor: FlightState): InteractionResult {
  if (puzzle.solved) return result(true, 'The Tidebound Sigil is already awakened.');
  if (actor.transition) return result(false, 'Finish the current flight maneuver first.');
  if (actor.form !== 'small') return result(false, 'Only the small bonded dragon can open the Tidegate.');

  if (actor.controlTarget === 'dragon') {
    if (actor.mode !== 'ground') return result(false, 'The dragon must stand on solid ground.');
    if (!near(actor.x, actor.z, TIDEGATE.dragon, TIDEGATE.interactRadius)) {
      return result(false, 'Move the small dragon to the left Tidegate stone.');
    }
    puzzle.dragonAnchored = true;
    return result(true, 'Dragon rune anchored. Press Tab and guide the rider to the other stone.');
  }

  if (actor.riderMode !== 'ground') return result(false, 'The rider must stand on dry ground.');
  if (!near(actor.riderX, actor.riderZ, TIDEGATE.rider, TIDEGATE.interactRadius)) {
    return result(false, 'Guide the young dragonkin to the right Tidegate stone.');
  }
  stepTidegate(puzzle, actor);
  if (!puzzle.dragonAnchored) {
    return result(false, 'The dragon must anchor the left rune and stay on its stone.');
  }
  puzzle.solved = true;
  return result(true, 'Tidebound Sigil awakened! The paired runes reveal an ancient bond.');
}

export function tidegateNearby(actor: FlightState): boolean {
  const x = actor.controlTarget === 'rider' ? actor.riderX : actor.x;
  const z = actor.controlTarget === 'rider' ? actor.riderZ : actor.z;
  return near(x, z, TIDEGATE.dragon, TIDEGATE.approachRadius)
    || near(x, z, TIDEGATE.rider, TIDEGATE.approachRadius);
}

export function tidegateHint(puzzle: TidegateState, actor: FlightState): string {
  if (puzzle.solved) return 'Tidebound Sigil awakened · session progress';
  if (actor.form !== 'small') return 'Land, then press 1 to shrink the dragon';
  if (!puzzle.dragonAnchored) return 'Dragon: stand on left stone, press G';
  return actor.controlTarget === 'dragon'
    ? 'Dragon anchored · Tab to control the rider'
    : 'Rider: approach the right stone and press G';
}
