import { describe, expect, it } from 'vitest';
import { CoastDiscovery, DISCOVERY_RADIUS_METERS } from '../src/world/discoveries';
import { LANDMARKS } from '../src/world/terrain';

describe('Azure Coast landmark discovery', () => {
  it('discovers landmarks once and tracks unique locations', () => {
    const c = new CoastDiscovery();
    const harbor = LANDMARKS[0]!;
    expect(c.update(harbor.x, harbor.z)).toHaveLength(1);
    expect(c.update(harbor.x, harbor.z)).toHaveLength(0);
    expect(c.count()).toBe(1);
    expect(c.visitedIds()).toContain(harbor.id);
  });
  it('only reveals landmarks inside their discovery radius', () => {
    const c = new CoastDiscovery();
    const harbor = LANDMARKS[0]!;
    expect(c.update(harbor.x + DISCOVERY_RADIUS_METERS + 1, harbor.z)).toHaveLength(0);
    expect(c.update(harbor.x + DISCOVERY_RADIUS_METERS - 1, harbor.z)).toHaveLength(1);
  });
  it('offers a remaining landmark and recognizes full exploration', () => {
    const c = new CoastDiscovery();
    expect(c.nearest(-1230, 90)?.id).toBe('azure.harbor');
    for (const anchor of LANDMARKS) c.update(anchor.x, anchor.z);
    expect(c.count()).toBe(LANDMARKS.length);
    expect(c.nearest(0, 0)).toBeNull();
  });
});
