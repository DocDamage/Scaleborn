export type AssetManifestEntry = {
  id: string;
  type: 'creature' | 'character' | 'structure' | 'vegetation' | 'terrain' | 'water';
  source: 'procedural' | 'glb';
  replacementPath?: string;
  rigId?: string;
  sockets?: readonly string[];
  dimensionsMeters?: readonly [number, number, number];
};

/** Stable IDs are owned by game data, never by the renderer or by GLB paths. */
export const ASSETS: readonly AssetManifestEntry[] = [
  { id: 'creature.dragon.onyx', type: 'creature', source: 'glb',
    replacementPath: 'models/characters/onyx-scaleborn-original.glb', rigId: 'rig.dragon.v2',
    sockets: ['seat', 'head', 'leftWing', 'rightWing', 'tailTip'], dimensionsMeters: [8, 2.5, 7] },
  { id: 'character.rider.hero', type: 'character', source: 'glb',
    replacementPath: 'models/characters/hero-hybrid-original.glb', rigId: 'rig.rider.v2',
    sockets: ['root', 'leftHand', 'rightHand'], dimensionsMeters: [0.6, 1.52, 0.4] },
  { id: 'structure.azure.cottage', type: 'structure', source: 'procedural' },
  { id: 'structure.azure.lighthouse', type: 'structure', source: 'procedural' },
  { id: 'structure.azure.temple', type: 'structure', source: 'procedural' },
  { id: 'vegetation.azure.tree', type: 'vegetation', source: 'procedural' },
  { id: 'vegetation.azure.kelp', type: 'vegetation', source: 'procedural' },
  { id: 'vegetation.azure.coral', type: 'vegetation', source: 'procedural' },
  { id: 'structure.azure.sunken-shrine', type: 'structure', source: 'procedural' },
  { id: 'structure.azure.sunken-shrine.echo', type: 'structure', source: 'procedural' },
  { id: 'structure.azure.tidegate', type: 'structure', source: 'procedural' },
  { id: 'terrain.azure.coast', type: 'terrain', source: 'procedural' },
  { id: 'water.azure.ocean', type: 'water', source: 'procedural' },
  { id: 'water.azure.mirrorfall-lake', type: 'water', source: 'procedural' },
  { id: 'water.azure.mirrorfall-cascade', type: 'water', source: 'procedural' },
  { id: 'terrain.azure.mirrorfall-cliff', type: 'terrain', source: 'procedural' },
  { id: 'vegetation.azure.pbr-tree', type: 'vegetation', source: 'procedural' },
  { id: 'vegetation.azure.waving-grass', type: 'vegetation', source: 'procedural' },
  { id: 'terrain.azure.rounded-pbr-boulders', type: 'terrain', source: 'procedural' },
] as const;

export function getAsset(id: string): AssetManifestEntry {
  const asset = ASSETS.find((item) => item.id === id);
  if (!asset) throw new Error('Unknown asset ID: ' + id);
  return asset;
}

export function assertManifestUnique(): void {
  const ids = new Set<string>();
  for (const asset of ASSETS) {
    if (ids.has(asset.id)) throw new Error('Duplicate asset ID: ' + asset.id);
    ids.add(asset.id);
  }
}
