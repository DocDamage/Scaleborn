import { AZURE_SEED, LANDMARKS } from '../world/terrain';
import type { TidegateState } from '../world/tidegate';
import { newTidalEchoState, validatedEchoState, type TidalEchoState } from '../world/tidalEcho';

export const AZURE_PROGRESS_KEY = 'scaleborn.azure-progress.v1';
export const AZURE_PROGRESS_VERSION = 1;

export interface ProgressStorage {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
}

export interface AzureProgress {
  version: 1;
  worldSeed: number;
  tidegateSolved: boolean;
  /** Additive v1 field: older saves without it remain valid. */
  gloamCleared: boolean;
  echo: TidalEchoState;
  discovered: string[];
}

export function freshAzureProgress(): AzureProgress {
  return {
    version: AZURE_PROGRESS_VERSION,
    worldSeed: AZURE_SEED,
    tidegateSolved: false,
    gloamCleared: false,
    echo: newTidalEchoState(),
    discovered: [],
  };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

const validLandmarks = new Set(LANDMARKS.map((point) => point.id));

/** Invalid versions, seeds, types or malformed localStorage content fail closed. */
export function parseAzureProgress(value: unknown): AzureProgress {
  const fresh = freshAzureProgress();
  if (!isRecord(value) || value.version !== AZURE_PROGRESS_VERSION ||
    value.worldSeed !== AZURE_SEED ||
    typeof value.tidegateSolved !== 'boolean' ||
    !isRecord(value.echo) || typeof value.echo.collected !== 'boolean' ||
    typeof value.echo.attuned !== 'boolean' || !Array.isArray(value.discovered)) return fresh;
  const tidegateSolved = value.tidegateSolved;
  const echo = validatedEchoState({
    collected: value.echo.collected,
    attuned: value.echo.attuned,
  }, tidegateSolved);
  const discovered = [...new Set(value.discovered.filter(
    (item): item is string => typeof item === 'string' && validLandmarks.has(item),
  ))].sort();
  // Missing/invalid new field defaults to false; do not discard unrelated
  // v1 Tidegate and Echo milestones when loading a pre-combat save.
  const gloamCleared = value.gloamCleared === true;
  return { ...fresh, tidegateSolved, gloamCleared, echo, discovered };
}

export function loadAzureProgress(storage: ProgressStorage | null): AzureProgress {
  if (!storage) return freshAzureProgress();
  try {
    const json = storage.getItem(AZURE_PROGRESS_KEY);
    return json === null ? freshAzureProgress() : parseAzureProgress(JSON.parse(json) as unknown);
  } catch {
    return freshAzureProgress();
  }
}

export function saveAzureProgress(storage: ProgressStorage | null, progress: AzureProgress): boolean {
  if (!storage) return false;
  try {
    const validated = parseAzureProgress(progress);
    storage.setItem(AZURE_PROGRESS_KEY, JSON.stringify(validated));
    return true;
  } catch {
    return false; // Private browsing, quota or disabled storage must not crash play.
  }
}

/** Only stable puzzle milestones persist; positioning and temporary rune anchors do not. */
export function snapshotAzureProgress(
  gate: TidegateState, echo: TidalEchoState, discoveredIds: readonly string[],
  gloamCleared = false,
): AzureProgress {
  return parseAzureProgress({
    version: AZURE_PROGRESS_VERSION,
    worldSeed: AZURE_SEED,
    tidegateSolved: gate.solved,
    gloamCleared,
    echo,
    discovered: [...discoveredIds],
  });
}
