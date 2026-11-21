import { describe, expect, it } from 'vitest';
import { ASSETS, assertManifestUnique, getAsset } from '../src/data/assets';
import { AZURE_SEED, biomeAt, heightAt, WORLD_WIDTH_METERS } from '../src/world/terrain';
import { hash2, rng } from '../src/core/random';

describe('procedural world contract', () => {
  it('generates reproducible world heights and meaningful island elevations', () => {
    expect(heightAt(100, -700)).toBe(heightAt(100, -700));
    expect(heightAt(-555, 100)).toBeGreaterThan(35);
    expect(heightAt(1950, 1950)).toBeLessThan(0);
    expect(WORLD_WIDTH_METERS).toBe(4000);
    expect(AZURE_SEED).toBeTruthy();
  });
  it('changes with the world seed but never with iteration order', () => {
    const a = heightAt(200, -250, 1234);
    heightAt(-100, 99, 2222);
    expect(heightAt(200, -250, 1234)).toBe(a);
    expect(heightAt(200, -250, 9999)).not.toBe(a);
  });
  it('provides useful deterministic biome and random queries', () => {
    expect(biomeAt(1950, 1950)).toBe('seabed');
    expect(hash2(15, 22, 10)).toBe(hash2(15, 22, 10));
    const a = rng(123); const b = rng(123);
    expect([a(), a(), a()]).toEqual([b(), b(), b()]);
  });
  it('keeps all asset identifiers unique and resolves them', () => {
    expect(() => assertManifestUnique()).not.toThrow();
    expect(new Set(ASSETS.map((a) => a.id)).size).toBe(ASSETS.length);
    expect(getAsset('creature.dragon.onyx').rigId).toBe('rig.dragon.v1');
    expect(() => getAsset('nonexistent')).toThrow();
  });
});
