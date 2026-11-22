import { describe, expect, it } from 'vitest';
import { GRAND_LAKE, lakeContains } from '../src/world/highlandLake';
import { heightAt } from '../src/world/terrain';
import { dragonBottomY } from '../src/world/waterPhysics';
import { findLakebedReviewViewpoint } from '../src/world/lakebedReviewViewpoint';

describe('actual shallow lakebed browser visual acceptance site', () => {
  it('selects a stable, deep-enough planted shelf from current collision geometry', () => {
    const site = findLakebedReviewViewpoint();
    const { x, z, bedY, eyeY, depth } = site;
    expect(findLakebedReviewViewpoint()).toEqual(site);
    expect(lakeContains(x, z)).toBe(true);
    expect(lakeContains(x + 10, z)).toBe(true);
    expect(lakeContains(x - 10, z)).toBe(true);
    expect(bedY).toBeCloseTo(heightAt(x, z), 6);
    expect(depth).toBeCloseTo(GRAND_LAKE.surfaceY - bedY, 6);
    expect(depth).toBeGreaterThanOrEqual(11);
    expect(depth).toBeLessThanOrEqual(25);
    expect(eyeY).toBeGreaterThan(dragonBottomY(x, z, 'rideable') + 0.25);
    expect(eyeY).toBeLessThan(GRAND_LAKE.surfaceY - 5);
    // Face west toward the rise in the planted bank, while the real camera
    // remains fully below the waterline and its chase point stays in the lake.
    expect(heightAt(x - 10, z)).toBeGreaterThan(bedY);
    const span = 2.5;
    const slope = Math.hypot(
      heightAt(x + span, z) - heightAt(x - span, z),
      heightAt(x, z + span) - heightAt(x, z - span),
    ) / (2 * span);
    expect(slope).toBeLessThan(0.65);
  });
});
