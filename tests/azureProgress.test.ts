import { describe, expect, it } from 'vitest';
import { AZURE_SEED } from '../src/world/terrain';
import {
  AZURE_PROGRESS_KEY, freshAzureProgress, loadAzureProgress, saveAzureProgress,
  snapshotAzureProgress, parseAzureProgress,
} from '../src/data/azureProgress';

class MemoryStore {
  data = new Map<string, string>();
  getItem(key: string): string | null { return this.data.get(key) ?? null; }
  setItem(key: string, value: string): void { this.data.set(key, value); }
}

describe('bounded versioned Azure Coast progress', () => {
  it('saves and restores completed puzzle milestones and valid discoveries', () => {
    const store = new MemoryStore();
    const data = snapshotAzureProgress(
      { solved: true, dragonAnchored: true },
      { collected: true, attuned: true },
      ['azure.tidegate', 'azure.sunken-shrine', 'bogus', 'azure.tidegate'],
    );
    expect(saveAzureProgress(store, data)).toBe(true);
    expect(store.data.has(AZURE_PROGRESS_KEY)).toBe(true);
    const loaded = loadAzureProgress(store);
    expect(loaded.echo).toEqual({ collected: true, attuned: true });
    expect(loaded.tidegateSolved).toBe(true);
    expect(loaded.discovered).toEqual(['azure.sunken-shrine', 'azure.tidegate']);
    expect(JSON.stringify(loaded)).not.toContain('dragonAnchored');
  });
  it('rejects mismatched versions, seeds, types and unknown nested content', () => {
    const good = { ...freshAzureProgress(), tidegateSolved: true };
    expect(parseAzureProgress({ ...good, worldSeed: AZURE_SEED + 1 }).tidegateSolved).toBe(false);
    expect(parseAzureProgress({ ...good, version: 999 }).tidegateSolved).toBe(false);
    expect(parseAzureProgress({ ...good, echo: { collected: 'yes', attuned: false } }))
      .toEqual(freshAzureProgress());
    expect(parseAzureProgress({ ...good, discovered: 'bad-data' })).toEqual(freshAzureProgress());
    expect(parseAzureProgress({ ...good, discovered: ['unknown', 42] }).discovered).toEqual([]);
  });
  it('prevents returning a collected Echo when Tidegate is not completed', () => {
    const invalid = {
      ...freshAzureProgress(),
      echo: { collected: true, attuned: true },
    };
    expect(parseAzureProgress(invalid).echo).toEqual({ collected: false, attuned: false });
  });
  it('handles corrupted or blocked storage without crashing the game', () => {
    const bad = new MemoryStore();
    bad.data.set(AZURE_PROGRESS_KEY, '{broken');
    expect(loadAzureProgress(bad)).toEqual(freshAzureProgress());
    const throwing = {
      getItem(): string | null { throw new Error('denied'); },
      setItem(): void { throw new Error('quota'); },
    };
    expect(loadAzureProgress(throwing)).toEqual(freshAzureProgress());
    expect(saveAzureProgress(throwing, freshAzureProgress())).toBe(false);
    expect(loadAzureProgress(null)).toEqual(freshAzureProgress());
    expect(saveAzureProgress(null, freshAzureProgress())).toBe(false);
  });
});
