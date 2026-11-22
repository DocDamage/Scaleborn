import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import type { CharacterKind, CharacterModelFile } from '../rider/importedCharacterRig';

/**
 * CC0 source assets installed by scripts/vendor-characters.mjs into the
 * public/models folder. Runtime uses the local, committed copies first.
 *
 * Fallback URLs preserve gameplay on an unvendored development checkout.
 * They are explicit licensed origins, never arbitrary user-supplied URLs.
 */
export const CHARACTER_MODEL_SOURCES: Readonly<Record<CharacterKind, {
  readonly id: string;
  readonly file: string;
  readonly original: string;
  readonly license: string;
}>> = {
  dragon: {
    id: 'creature.dragon.onyx',
    file: 'models/characters/onyx-rigged.glb',
    original: 'https://afk.ai/auto-rig-models/dragon.glb',
    license: 'CC0-1.0',
  },
  rider: {
    id: 'character.rider.hero',
    file: 'models/characters/hero-rigged.glb',
    original: 'https://grab3d.com/dl/elf-rigged/elf-rigged.glb',
    license: 'CC0-1.0',
  },
};

export function characterAssetUrl(
  kind: CharacterKind, base = import.meta.env.BASE_URL || '/',
): string {
  const relative = CHARACTER_MODEL_SOURCES[kind].file;
  return base.replace(/\/?$/, '/') + relative;
}

export async function loadCharacterModel(
  kind: CharacterKind,
  loader = new GLTFLoader(),
): Promise<CharacterModelFile> {
  const source = CHARACTER_MODEL_SOURCES[kind];
  try {
    return await loader.loadAsync(characterAssetUrl(kind));
  } catch (localError) {
    // Local copy should always exist for release. Permit a remote fallback
    // only for development while assets are being acquired for a checkout.
    if (!import.meta.env.DEV) {
      throw new Error('Missing vendored character model: ' + source.file, { cause: localError });
    }
    return loader.loadAsync(source.original);
  }
}
