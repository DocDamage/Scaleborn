# Scaleborn — original protagonist and dragon visual contract

**Design authority:** the approved Scaleborn master codex and technical blueprint.
**Status:** character replacement infrastructure implemented; final authored
hero and dragon GLB meshes have not yet been produced or approved.

## Onyx: the dragon

The model must be an original, recognizable painterly dark-fantasy character,
**not** a generic stock dragon and **not** an imitation of an existing film dragon.

Required art direction:
- Streamlined, elongated organic four-legged torso and a flexible tail,
  seamless skinned joints, and distinctive silhouette at all three sizes.
- Midnight navy/black scales with subtle violet iridescence, material-normal
  variation, expressive facial brows, visible eyes, and bioluminescent markings.
- Uniquely backward-swept fin crests, expressive mobile ears/crests,
  retractable horns and distinctive tail fins.
- Independently articulated wing fingers, smooth skinned membranes,
  scalloped painted wing profile and subtle tension/wind response.
- Land, air and water animation states: idle, walk/gallop, takeoff, flap,
  glide, bank, land, swim, dive, breach, react/express, transform.
- Sizes preserve one character identity: small (0.84m), rideable (4.55m)
  and giant (~12.04m) under the existing three-form gameplay contract.
- Rider seating and camera profiles must remain physically and visually
  workable in each supported mode.

**GLB identity:** `creature.dragon.onyx` with
`scene.userData.scalebornDesign = "scaleborn.onyx.design.v1"`.
The imported model is normalized to seven metres base length; Three.js gameplay
scales it according to `FORMS`. The source mesh must include a real skin/rig,
named motion clips and stable attachment metadata. Donor animation skeletons may
be retargeted offline, but their unrelated character mesh must never ship
as Onyx.

## The rider: original dragon-human hybrid girl

- Age 13, anatomically child-appropriate, recognizable facial proportions.
- Real expressive face, subtle hybrid horns, scattered dragon scales and
  articulated tail. **Not** an elf, adult knight, generic fantasy ranger or
  borrowed figure.
- Custom weathered coastal-fantasy attire designed for grounded travel,
  swimming and dragon riding, with painterly cloth/leather materials.
- Fully skinned arms/hands, legs/feet, neck/head and tail; motion clips for
  idle, walk, run, mounted grip/lean, swim, dive and interactions.
- Height normalized to 1.52 m independent of dragon form; she cannot
  inherit the dragon body's three-form scale.

**GLB identity:** `character.rider.hero` with
`scene.userData.scalebornDesign = "scaleborn.hero.design.v1"`.

## Integration rules

1. Authored, rigged model exports belong in
   `public/models/characters/onyx-scaleborn-original.glb` and
   `public/models/characters/hero-hybrid-original.glb`.
2. The GLB loader accepts only the above character identity metadata.
   Missing or unapproved models do not trigger a stock-model download.
3. The old procedural meshes remain as a **temporary load-failure fallback**
   in the unfinished development build, not as finished character art.
4. Simulation, actor IDs, collision, movement, save data and form changes
   stay independent of the mesh implementation.
5. Approve final work only from **actual engine screenshots and playable
   builds**, showing silhouette, faces, wings and cloth, transition animation,
   mount alignment, lake contact and three-form scaling.
6. No final-quality or asset-replacement claim until both authored meshes
   exist, load successfully, match this design and pass animation/visual QA.

The character acceptance gate is **BLOCKED** while either original mesh is
missing. Import infrastructure and placeholder removal are separate tasks.
