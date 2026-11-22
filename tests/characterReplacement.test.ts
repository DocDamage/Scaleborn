import * as THREE from 'three';
import { describe, expect, it } from 'vitest';
import { ImportedCharacterRig, findCharacterClip } from '../src/actors/rider/importedCharacterRig';
import { DragonVisual } from '../src/actors/dragon/visual';
import { newFlightState } from '../src/actors/dragon/flight';
import { FORMS } from '../src/actors/dragon/forms';
import { getAsset, assertManifestUnique } from '../src/data/assets';
import { characterAssetUrl, CHARACTER_MODEL_SOURCES } from '../src/actors/dragon/characterSources';

function model(width: number, height: number, length: number,
  names: string[]): { scene: THREE.Group; animations: THREE.AnimationClip[] } {
  const geometry = new THREE.BoxGeometry(width,height,length);
  geometry.translate(0,height*.5,0);
  const vertices = geometry.getAttribute('position').count;
  const indices = new Uint16Array(vertices*4);
  const weights = new Float32Array(vertices*4);
  for (let i=0;i<vertices;i++) weights[i*4]=1;
  geometry.setAttribute('skinIndex',new THREE.Uint16BufferAttribute(indices,4));
  geometry.setAttribute('skinWeight',new THREE.Float32BufferAttribute(weights,4));
  const bone=new THREE.Bone();
  bone.name='Hips';
  const mesh=new THREE.SkinnedMesh(geometry,
    new THREE.MeshStandardMaterial({ color:0x41636c }));
  mesh.add(bone);
  mesh.bind(new THREE.Skeleton([bone]));
  const group=new THREE.Group();
  group.add(mesh);
  const clips=names.map(name=>new THREE.AnimationClip(name,1,[
    new THREE.NumberKeyframeTrack('Hips.position[y]',[0,1],[0,.001]),
  ]));
  return {scene:group,animations:clips};
}

describe('rigged GLB dragon and rider replacement',()=>{
  it('preserves stable asset IDs, dimensions and local distribution paths',()=>{
    assertManifestUnique();
    for (const kind of ['dragon','rider'] as const){
      const asset=getAsset(CHARACTER_MODEL_SOURCES[kind].id);
      expect(asset.source).toBe('procedural');
      expect(asset.replacementPath).toBe(CHARACTER_MODEL_SOURCES[kind].file);
      expect(asset.rigId).toMatch(/rig\.(dragon|rider)\.v2/);
      expect(characterAssetUrl(kind,'/scaleborn/'))
        .toBe('/scaleborn/'+CHARACTER_MODEL_SOURCES[kind].file);
      expect(CHARACTER_MODEL_SOURCES[kind].design)
        .toMatch(/^scaleborn\.(onyx|hero)\.design\.v1$/);
      expect(CHARACTER_MODEL_SOURCES[kind].file).toContain('original.glb');
    }
  });

  it('normalizes a real skinned dragon rig to its authored 7m length',()=>{
    const imported=new ImportedCharacterRig('dragon',
      model(10,3,4,['Idle','Walk','Fly Flap','Fly Glide','Take Off','Land']));
    try {
      expect(imported.hasSkeleton).toBe(true);
      expect(imported.sizeMeters.z).toBeCloseTo(7,5);
      expect(imported.root.userData.assetId).toBe('creature.dragon.onyx');
      imported.animateDragon({
        name:'fly',flapPhase:0,flapAmount:.3,wingFold:0,gaitPhase:0,
        gaitAmount:0,neckAngle:0,tailAngle:0,bodyBob:0,riderLean:0,
      },1/60);
      expect(imported.animationName).toBe('Fly Glide');
      imported.animateDragon({
        name:'launch',flapPhase:0,flapAmount:.3,wingFold:0,gaitPhase:0,
        gaitAmount:0,neckAngle:0,tailAngle:0,bodyBob:0,riderLean:0,
      },1/60);
      expect(imported.animationName).toBe('Take Off');
    }finally {imported.dispose();}
  });

  it('keeps a human-scale rider as the dragon grows and dismounts',()=>{
    const visual=new DragonVisual();
    const scene=new THREE.Scene();
    visual.attach(scene);
    // Deterministic injection of rigged assets; network loads are ignored
    // after disposal by the production async import guard.
    visual.replaceCharacter('dragon',model(8,3,4,['Idle','Fly Glide']));
    visual.replaceCharacter('rider',model(.7,1.8,.45,['Walk','Run']));
    const flight=newFlightState();
    flight.y=220;flight.time=1;
    visual.update(flight);
    expect(visual.modelStatus.dragon).toBe('ready');
    expect(visual.modelStatus.rider).toBe('ready');
    expect(visual.rider.getObjectByName('character.rider.hero.imported')).toBeDefined();
    expect(visual.body.getObjectByName('creature.dragon.onyx.imported')).toBeDefined();
    const imported=visual.rider.getObjectByName('character.rider.hero.imported') as THREE.Group;
    expect(imported.scale.x).toBe(1);
    flight.form='giant';
    flight.time=2;
    visual.update(flight);
    expect(visual.body.scale.x).toBeGreaterThan(FORMS.rideable.visualScale);
    expect(visual.rider.scale.x).toBe(1);
    flight.form='small';
    flight.time=3;
    visual.update(flight);
    expect(visual.rider.parent).toBe(scene);
    expect(imported.parent).toBe(visual.rider);
    visual.dispose();
    expect(scene.children.length).toBe(0);
  });

  it('uses named actions instead of guessing the first clip',()=>{
    const idle=new THREE.AnimationClip('Armature|Idle',1,[]);
    const fly=new THREE.AnimationClip('Fly_Glide',1,[]);
    expect(findCharacterClip([idle,fly],['Fly Glide'])).toBe(fly);
    expect(findCharacterClip([idle,fly],['Death'])).toBeUndefined();
  });

  it('rejects static meshes masquerading as character rigs',()=>{
    const source={scene:new THREE.Group(),animations:[new THREE.AnimationClip('Idle',1,[])]};
    source.scene.add(new THREE.Mesh(new THREE.BoxGeometry(1,1,1)));
    expect(()=>new ImportedCharacterRig('dragon',source)).toThrow(/skinned rig/);
  });
});
