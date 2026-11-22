import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import type { CharacterKind, CharacterModelFile } from '../rider/importedCharacterRig';

/**
 * Scaleborn's protagonists are original characters, not third-party sample
 * dragon/elf skins. These paths are reserved for authored assets that satisfy
 * docs/CHARACTER_ART_DIRECTION.md. An imported rig or animation donor cannot
 * be displayed as the approved final character.
 *
 * Until an authored GLB exists, DragonVisual retains its existing source
 * fallback rather than silently showing an unrelated third-party character.
 */
export const CHARACTER_MODEL_SOURCES: Readonly<Record<CharacterKind, {
  readonly id: string;
  readonly file: string;
  readonly design: string;
  readonly installed: boolean;
}>> = {
  dragon: {
    id: 'creature.dragon.onyx',
    file: 'models/characters/onyx-scaleborn-original.glb',
    design: 'scaleborn.onyx.design.v1',
    installed: false,
  },
  rider: {
    id: 'character.rider.hero',
    file: 'models/characters/hero-hybrid-original.glb',
    design: 'scaleborn.hero.design.v1',
    installed: false,
  },
};

export function characterAssetUrl(
  kind: CharacterKind, base = import.meta.env.BASE_URL || '/',
): string {
  return base.replace(/\/?$/, '/') + CHARACTER_MODEL_SOURCES[kind].file;
}

/**
 * Only authored and explicitly designated character files are ever loaded.
 * The GLB exporter must put its design ID into glTF scene extras/userData.
 */
export async function loadCharacterModel(
  kind: CharacterKind,
  loader = new GLTFLoader(),
): Promise<CharacterModelFile> {
  const source = CHARACTER_MODEL_SOURCES[kind];
  if (!source.installed) {
    throw new Error('Original Scaleborn GLB has not been authored: ' + source.file);
  }
  const asset = await loader.loadAsync(characterAssetUrl(kind));
  const actual = asset.scene.userData.scalebornDesign;
  if (actual !== source.design) {
    throw new Error('Character asset lacks the approved Scaleborn design identity: '
      + source.file);
  }
  return asset;
}
