import { describe, expect, it } from 'vitest';
import { makePaintedSurfaceTextures } from '../src/world/surfaceTextures';

describe('authored procedural PBR surface texture maps',()=>{
  it('generates full-color, normal and roughness maps for each surface type',()=>{
    for(const kind of ['soil','rock','bark'] as const){
      const maps=makePaintedSurfaceTextures(kind,64);
      try {
        const colors=maps.color.image.data as Uint8Array;
        const normals=maps.normal.image.data as Uint8Array;
        const rough=maps.roughness.image.data as Uint8Array;
        expect(colors).toHaveLength(64*64*4);
        expect(normals).toHaveLength(colors.length);
        expect(rough).toHaveLength(colors.length);
        expect(new Set(Array.from(colors).filter((_,i)=>i%4===0)).size)
          .toBeGreaterThan(18);
        expect(normals[2]).toBeGreaterThan(185);
      } finally { Object.values(maps).forEach(t=>t.dispose()); }
    }
  });
  it('is deterministic and periodic, without obvious tiled boundary color discontinuity',()=>{
    const a=makePaintedSurfaceTextures('rock',96);
    const b=makePaintedSurfaceTextures('rock',96);
    try {
      const x=a.color.image.data as Uint8Array;
      const y=b.color.image.data as Uint8Array;
      expect(Array.from(x)).toEqual(Array.from(y));
      const left=x[4*(48*96)]??0;
      const right=x[4*(48*96+95)]??0;
      expect(Math.abs(left-right)).toBeLessThan(30);
    } finally {
      Object.values(a).forEach(t=>t.dispose());
      Object.values(b).forEach(t=>t.dispose());
    }
  });
  it('refuses unbounded texture sizes',()=>{
    expect(()=>makePaintedSurfaceTextures('soil',0)).toThrow();
    expect(()=>makePaintedSurfaceTextures('soil',2000)).toThrow();
  });
});
