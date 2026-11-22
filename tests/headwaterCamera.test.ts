import { describe, expect, it } from 'vitest';
import { GRAND_LAKE, MIRRORFALL, headwaterProfileAt,
  headwaterContains, waterSurfaceAt } from '../src/world/highlandLake';
import { heightAt } from '../src/world/terrain';

describe('repeatable in-game feeder stream review viewpoint',()=>{
  it('stages a dry riverbank facing west over navigable upper water',()=>{
    const x=MIRRORFALL.x+64;
    const p=headwaterProfileAt(x,GRAND_LAKE.z);
    expect(p).not.toBeNull();
    const bankZ=p!.centerZ+p!.halfWidth*1.18;
    const waterZ=p!.centerZ;
    expect(headwaterContains(x,bankZ)).toBe(false);
    expect(waterSurfaceAt(x,bankZ)).toBe(0);
    expect(headwaterContains(x,waterZ)).toBe(true);
    expect(waterSurfaceAt(x,waterZ)-heightAt(x,waterZ))
      .toBeGreaterThan(1.2);
    expect(heightAt(x,bankZ)).toBeGreaterThan(p!.surfaceY-1);
    expect(x).toBeGreaterThan(MIRRORFALL.x);
  });
});
