# Scaleborn — original protagonist and dragon visual contract

**Design authority:** the approved Scaleborn master codex and technical blueprint.
**Status:** a first original, in-engine 3D sculpt for both characters is now
implemented in real gameplay, with skeletal wing deformation and rider pose
sockets. Final art approval, full character skeletons, facial animation and
authored GLB exports remain incomplete.

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
3. The former ellipsoid/primitive characters have been replaced by original
   lofted body, head, horn, fin, clothing and appendage geometry generated
   by `organicSculpt.ts` and `heroSculpt.ts`. These are a genuine first
   modeling pass, but still need art review and professional refinement.
   Missing GLBs do not trigger third-party downloads or browser 404s.
4. Simulation, actor IDs, collision, movement, save data and form changes
   stay independent of the mesh implementation.
5. Approve final work only from **actual engine screenshots and playable
   builds**, showing silhouette, faces, wings and cloth, transition animation,
   mount alignment, lake contact and three-form scaling.
6. No final-quality or asset-replacement claim until both authored meshes
   exist, load successfully, match this design and pass animation/visual QA.

The character acceptance gate remains **BLOCKED** for final visual release:
the current original code-generated meshes must be reviewed from actual
gameplay renders, then refined and/or rebuilt as production sculpted, fully
rigged GLBs. A first playable sculpt is not equivalent to accepted final art.


## Implemented first sculpt (character visual pass 1)

- `src/actors/dragon/organicSculpt.ts` lofts contiguous torso, skull and
  tapering tail surfaces with high-resolution smooth vertex normals and
  original fin/crest and horn geometry. Surface normals are outward-facing
  and materials retain the existing detailed, normal-mapped scale treatment.
- `src/actors/dragon/wingRig.ts` uses a dense curved, scalloped membrane
  with smoothly blended weights on the established three wing joints.
  Wing tips, span, silhouette and spring are animated without changing
  the simulation or three-form scaling.
- `src/actors/rider/heroSculpt.ts` supplies a custom young hybrid face,
  horns, scale accents, clothes, cloak, boots, articulated tail and named
  arm/leg pivots for the existing `riderPose` movement states.
- `scripts/character-capture.mjs` captures actual game frames of
  Onyx's small, rideable and giant sizes, plus the independent rider.
  Render quality must be reviewed, not inferred from unit tests.
- The local-first GLB adapter is retained for future authored production
  models, with `installed:false` until valid original exports exist.
  No stock-model fallback or externally downloaded elf is approved.

## Character visual continuation — deforming Onyx tail

The first character sculpt kept its tail rigid and swung the entire mesh around
a single root pivot. `src/actors/dragon/dragonTailRig.ts` now provides a
continuous, three-bone skinned tail with normalized overlapping weights and
smooth, distinct middle/tip motion for walk, cruise, surge and underwater
swimming. The original split fins attach to an end-bone socket without
changing their authoring coordinates or the existing `tailTip` root ID.
This improves the playable creature's silhouette and expressive flexibility
without touching flight collision or rider-scale logic.

**Still required:** reviewed, production-quality sculpt/skin detailing,
rigged body and facial expressions, authored GLB and full animation clips,
and actual game screenshot/frame-rate acceptance.

## Onyx face and movable crests — visual continuation

The static first-sculpt eyes now blink as one complete iris, vertical pupil
and specular glint assembly; the former pupil-only blink exposed the entire
glowing iris. The sculpted upper eyelids and paired brows follow a deterministic
facial pose derived from flight/swim/landing/surge state. A real hinged jaw
opens subtly during high-effort motion, and the distinctive backward swept
fin crests flex with swimming and air speed. No new combat mechanics, donor
faces, or unrelated elf-type geometry are used.

The expression contract is in `src/actors/dragon/dragonExpression.ts`, with
integration inside `DragonVisual.update` and focused tests for deterministic
blinks, physical facial parts, crest motion and retained rider scale.
Full face morph targets, lip/teeth animation, expressive voice/breath audio,
and authored GLB facial rigging are still outstanding.

## Onyx painted wing material detail

`src/actors/dragon/wingSurface.ts` adds a deterministic original painted
membrane triplet: violet-tinted albedo, rib/vein tangent normals and local
roughness variation, tiled on the existing two high-resolution skinned wings.
The physically lit membrane retains the design's darker vertex-color
pigments and includes restrained clearcoat, sheen and violet iridescence
instead of a uniform flat plastic surface. No external textures, stock
dragon material, per-frame texture allocations, or altered wing bones.

The material remains an approximation: production wing hand-painting,
translucent scattering, close-up shader QA, correct posed normals and GPU
profile still require acceptance before final art signoff.

### Integrated procedural travel-cloak motion

The original young hybrid rider's cloak now uses a pinned-shoulder,
speed- and wind-responsive deformation in the real gameplay mesh. It retains
the rider's existing mount/limb sockets and fixed height. No per-frame geometry
buffers or downloaded character models are required. This restores the cloth
motion present in the earlier environment/rider pass while keeping the
Scaleborn-specific sculpt and GLB identity contract.

This is preliminary in-engine cloth animation, not fully authored rigging
or an approved final visual character.

### Screenshot-directed face and membrane proportion pass

The first actual close-up captures exposed green eyes protruding like round
toy globes and a comparatively bright lavender wing surface. The original
13-year-old heroine now has smaller almond-proportioned eyes closer to
her face, swept short dragon-hybrid horns and an original subtle nose
bridge, retaining every original actor ID and animation socket. No elf model
or adult replacement was introduced.

Onyx's existing high-resolution, skinned wings now use deeper navy vertex
pigments with restrained violet variation, retaining painted vein maps,
material iridescence and three-bone deformation. These improvements are
testable geometry/material changes, not final visual approvals. Review
real close-up gameplay captures on a dedicated GPU.
