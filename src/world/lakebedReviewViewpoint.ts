import { GRAND_LAKE, lakeContains } from './highlandLake';
import { heightAt } from './terrain';
import { dragonBottomY } from './waterPhysics';

/**
 * Chooses an actual accessible, planted freshwater shelf for WebGL acceptance
 * screenshots. Sampling the *current* collision terrain avoids hard-coded
 * camera locations drifting into shallow water as Mirrorfall's banks evolve.
 *
 * This is a development/QA viewpoint, never a player teleport or gameplay
 * fallback. Search order is fixed so identical seeds yield identical images.
 */
export interface LakebedReviewViewpoint {
  x: number;
  z: number;
  bedY: number;
  eyeY: number;
  depth: number;
}

const WEST_BANK_FRACTIONS = [0.84, 0.86, 0.82, 0.88, 0.80] as const;
const Z_OFFSETS = [0, 0.06, -0.06, 0.12, -0.12] as const;

/** Fail explicitly if no location meets physical and visual constraints. */
export function findLakebedReviewViewpoint(): LakebedReviewViewpoint {
  for (const fraction of WEST_BANK_FRACTIONS) {
    for (const offset of Z_OFFSETS) {
      const x = GRAND_LAKE.x - GRAND_LAKE.radiusX * fraction;
      const z = GRAND_LAKE.z + GRAND_LAKE.radiusZ * offset;
      // Camera, forward shelf and near-shore background all remain in lake.
      if (!lakeContains(x, z) || !lakeContains(x - 10, z)
        || !lakeContains(x + 10, z)) continue;

      const bedY = heightAt(x, z);
      const depth = GRAND_LAKE.surfaceY - bedY;
      if (depth < 11 || depth > 25) continue;
      const eyeY = bedY + 5.5;
      if (eyeY <= dragonBottomY(x, z, 'rideable') + 0.25
        || eyeY >= GRAND_LAKE.surfaceY - 5) continue;

      const sample = 2.5;
      const slope = Math.hypot(
        heightAt(x + sample, z) - heightAt(x - sample, z),
        heightAt(x, z + sample) - heightAt(x, z - sample),
      ) / (2 * sample);
      // LakebedHabitat plants only grow on suitably gentle ground.
      if (slope >= 0.65 || heightAt(x - 10, z) <= bedY) continue;
      return { x, z, bedY, eyeY, depth };
    }
  }
  throw new Error('No safe planted Mirrorfall lakebed screenshot viewpoint');
}
