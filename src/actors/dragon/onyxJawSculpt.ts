import * as THREE from 'three';
import { loftDragon, taperedSpine } from './organicSculpt';

/**
 * Original Onyx jaw anatomy, authored in the existing head-local space.
 * The flexible hinge remains owned by DragonVisual; this is its rest-space
 * moving flesh and lip silhouette, never a change to collision or AI.
 */
export function sculptOnyxLowerJaw(
  outerSkin:THREE.Material,lipSkin:THREE.Material,ivory:THREE.Material,
):THREE.Group {
  const jaw=new THREE.Group();
  jaw.name='creature.dragon.onyx.lower-jaw-sculpt';
  // The old jaw's (0,.17,.06) compensation remains inside this group, so
  // the original jawPivot at (0,-.17,-.06) stays exactly unchanged.
  jaw.position.set(0,.17,.06);
  const surface=new THREE.Mesh(loftDragon([
    [-1.13,-.255,.012,.012],
    [-1.045,-.268,.139,.067],
    [-.92,-.275,.228,.102],
    [-.76,-.259,.310,.118],
    [-.57,-.234,.397,.137],
    [-.36,-.207,.425,.147],
    [-.17,-.182,.360,.132],
    [.04,-.169,.208,.104],
    [.16,-.166,.042,.040],
  ],58,34),outerSkin);
  surface.name='creature.dragon.lower-jaw';
  surface.castShadow=true;
  surface.receiveShadow=true;
  jaw.add(surface);

  for(const side of [-1,1] as const){
    // These low-contrast inset seams move with the mandibular surface.
    // They define the mouth corners without the thick, dark cartoon grin
    // created by a freestanding black ellipse.
    const lip=new THREE.Mesh(taperedSpine([
      [side*.077,-.253,-1.080],
      [side*.195,-.238,-.947],
      [side*.283,-.209,-.759],
      [side*.357,-.180,-.562],
      [side*.389,-.157,-.375],
      [side*.333,-.121,-.192],
    ],.024,12,40),lipSkin);
    lip.name=side<0?'creature.dragon.lower-lip.left'
      :'creature.dragon.lower-lip.right';
    lip.castShadow=true;
    jaw.add(lip);

    // Two tapered, subtly curved enamel nubs are seated IN the jaw.
    // The tips separate naturally as the existing expression opens it.
    for(let index=0;index<2;index++){
      const z=-.82+index*.29;
      const x=.205+index*.105;
      const tooth=new THREE.Mesh(taperedSpine([
        [side*x,-.171,z],
        [side*(x+.006),-.131,z-.018],
        [side*(x+.014),-.094,z-.045],
        [side*(x+.021),-.088,z-.063],
      ],index===0?.030:.026,10,19),ivory);
      tooth.name='creature.dragon.lower-tooth.'+(side<0?'left':'right')
        +'.'+index;
      tooth.castShadow=true;
      jaw.add(tooth);
    }
  }
  return jaw;
}
