# Scaleborn — original characters: in-engine visual review & handoff

**Branch:** `feat/integrate-visual-character-combat`  
**PR:** #15, DRAFT / unmerged  
**Status:** **BLOCKED — no final character art approval**

## Completed code batches (2026-11-22)

| Commit | Actual integrated change | Automated check | Real WebGL verification |
|---|---|---|---|
| `ca90c514` | Onyx single-mesh cheek, orbit, shoulder/chest loft changes, breathing morph | Passed | New close-up not yet independently signed off |
| `767420bb` | Rider face cross-section, elbows/knees/ankles, woven fabric | Passed | Included in later captures |
| `264b85b1` / `c1e06eba` | Mounted joint pose and signed-zero test correction | Passed at `c1e06eba` | Mount alignment still requires side screenshots |
| `d785fc19` | Gameplay and mounted screenshot capture hooks | Passed after joint correction | Real captures integrated |
| `749906ed` | Original AI-assisted navy/violet source painting sampled to PBR torso/skull color map | Passed | Real WebGL artifact: [45076850537](https://github.com/DocDamage/Scaleborn/actions/runs/45076850537) |
| `3ee4f3c9` | Curved phalange tendons, anatomical wing-root and backward wing fold | Passed | Real WebGL artifact: [45076937778](https://github.com/DocDamage/Scaleborn/actions/runs/45076937778); inspected |
| `a4be17b6` | Original child's mouth/blinks, brows, pupils; fixed lint syntax | Passed | Real WebGL artifact: [45077127208](https://github.com/DocDamage/Scaleborn/actions/runs/45077127208) |
| `775d907d` | Brighter navy skin and inset dragon eyes, swept horn proportions | Passed | Earlier screenshot canceled by newer workflow concurrency |
| `8db64d03` | Rider and mounted side-angle QA cameras (not fake renders) | Passed | New screenshot capture pending |
| `c7609685` | Rider eyes closer to center, cheek scales embedded, swept original horn silhouette | New check pending at writing | New screenshot capture pending |

## Actual verified defects from 1280 × 720 Playwright / SwiftShader

Screenshots compared: baseline [45072277223](https://github.com/DocDamage/Scaleborn/actions/runs/45072277223), wing pass [45076937778](https://github.com/DocDamage/Scaleborn/actions/runs/45076937778), rider-expression pass [45077127208](https://github.com/DocDamage/Scaleborn/actions/runs/45077127208).

- **Improved but not accepted:** Folded wings now extend backward rather than dangling vertically alongside the dragon. Close-up front silhouettes still read like stiff lateral sails rather than anatomically muscular folding wings.
- **BLOCKING:** Onyx's face remains an overly rounded very dark silhouette in pre-`775d907d` real screenshot. Nose, cheek and orbit changes lack convincing visible shading and mouth/jaw integration. The later brightness pass needs direct review.
- **BLOCKING:** The rider's head and face remain strongly procedural and stiff in pre-`c7609685` captures, with previously over-spaced eyes, visible side protrusions and too-large nose. New code addresses these, but its result requires fresh review.
- **BLOCKING:** Shoulder/sleeve clothing geometry reads as straight tubular forms; locomotion and cloth still need more natural silhouettes and deformation.
- **BLOCKING:** Frontal mounted screenshots obscure most knee/foot placement. Contact/clipping acceptance cannot be made until `characters-rider-mounted-rideable-side.png` and giant side view are reviewed.
- **BLOCKING:** Full-size original 1254² AI-assisted scale painting still needs a production UV atlas. The integrated 32² index sample is a real art-data prototype, not final texture fidelity.
- **BLOCKING:** Hardware WebGL shading, RTX 3060 FPS, authored skeletal exports/GLBs, high-quality close-up gameplay renders and a human sign-off are still outstanding.

**All screenshot images cited here originate from actual gameplay Three.js WebGL frames. No generated concepts, fake gameplay or donor model was used as visual evidence.**

## Next character tasks

Review latest screenshots before modifying further: actual side mount, on-foot rider face, small/rideable/giant Onyx and chase distance. Fix visible overlap and silhouette defects first. Continue original procedural sculpt only as an interim character implementation; final authored, high-quality 3D meshes and multi-bone articulated rigs are still required. Preserve IDs, sockets, form logic and gameplay. Keep PR #15 draft.


## Live rendering correction — saddle and membrane silhouette (continuation)

At commit `f5296019`, side-on actual 1280×720 WebGL screenshots showed
severe mounted shin occlusion (rider legs inside Onyx's rideable back, and
the entire child lower body lost in giant form), plus outsized flat sail
membranes hanging down while Onyx was grounded.

The follow-on character batch adds:
- A physically measured dorsal seat offset against Onyx's continuous upper
  torso and 95 mm contact allowance; fixed child scale is retained.
- Outward abducted thigh/knee posture for rideable Onyx; knees tucked
  forward on giant Onyx, whose back is too wide for the child to straddle.
- A dense absolute-position fold morph and folded normal field on both
  original three-bone skinned wings. At rest the chord is pleated down to
  ~18% without deleting geometry or modifying the aerodynamic simulation.
- Deterministic rig and actual saddle-clearance regression tests.

Do **not** call these rendered improvements verified until the new
side-on screenshots are captured and inspected; the prior shots are
proof of the defect, not proof of correction. Keep PR #15 DRAFT.

### Spine mesh correction against real giant-form screenshots
Baseline side captures show rear dorsal spines hovering above Onyx as his
continuous torso tapers. `onyxDorsalY` now inverts the existing loft-section
curve and samples its exact upper meridian. Each original nine named cartilage
fins embeds 45 mm into that surface, becomes shorter over the rider's mounting
lane, and tapers naturally toward the tail. Material and names are retained.
Unit tests compare the dorsal sampler to real mesh vertices at all nine fin
positions; a fresh side-view WebGL capture is required before visual signoff.

### Side-by-side actual WebGL review at `c2e7f26`

The character QA workflow [45078900638](https://github.com/DocDamage/Scaleborn/actions/runs/45078900638)
completed successfully with original real in-engine captures in all three dragon
forms, independent rider, mounted rider and ordinary meadow chase framing.

**Visible improvements confirmed (not final art signoff):** rideable rider shins
and boots now clear Onyx's upper torso, giant rider is seated on the dorsal
shelf instead of buried, and original nine dorsal fins track tapering skin.
Grounded membrane chord is significantly narrower after three-bone morph.

**Still visibly blocking:** the folded leading-edge phalanges remain long
diagonal strips, especially across the giant side shot; small tail fins
appear disconnected, and the child and creature remain visibly procedural.
The next wing pass contracts the posed rib projection in tandem with pleated
membranes, with embedded tail-fin bases, no physics changes and dedicated
bounds/attachment regressions. Requires fresh actual screenshots to verify.

### Screenshot-directed dorsal wing tuck correction — 2026-11-22

The actual, successful `46f8674` WebGL [character run](https://github.com/DocDamage/Scaleborn/actions/runs/45079475750)
showed shorter folded finger bars, but they still aimed downward like
rigid spears beside Onyx, particularly in the giant-form side camera. The
`wingRig.ts` resting shoulder/elbow/tip Z rotations have been changed to
lift the already-pleated, contracted bone chain onto the back while keeping
the named three-bone skinned mesh and all open-flight angles unchanged.
Mirrored left/right joint assertions prevent regression. Next real WebGL
side-view captures must confirm both sides sit above the flank without
intersecting the fixed-scale rider or actual terrain; quality gate BLOCKING.

### Rider cloak surface fidelity and bank response — 2026-11-22

The existing live `makeScalebornRider` travel cloak had a woven albedo/normal/roughness material but **no UV attribute**, so the texture detail could not be sampled meaningfully. The cloak is now UV-unwrapped with tiled fabric maps, shallow painted vertex-pigment variation, pinned mantle shoulders, an asymmetrically folded back surface and an irregular weighted hem. Its persistent vertex buffer deforms with speed and bank, without changing the child-scale rider, mount sockets or traversal simulation; a conservative culling bound protects the mobile hem. Added `tests/riderCloakSurface.test.ts` covering geometry, texture sampling attributes, pinned seams, roll response and live `DragonVisual` integration. Full automated checks and genuine rider-height WebGL appearance remain **unverified** for this batch; no final character-art signoff.

### Original rider hand silhouette and wrist contact
The heroine's original small hand geometry is now a fitted continuous palm
with four individual softly tapered fingers and a separate thumb on each arm,
instead of one mitten mesh. The named wrist pivots receive restrained mounted
grip rotation from renderer-neutral rider pose channels, reset for independent
walking and swimming, and retarget to the corresponding bones in future
authored, approved original GLBs. Scale/age/costume identities unchanged.
Verify real WebGL face and mount close-ups for clipping and hand readability.

### Giant Onyx shoulder-cap integration (from actual WebGL defect)
The real giant-form side image at `46f8674` still showed flat pale
oval end caps on all four upper limbs. The leg lofts now originate at a
deeper, inward-bent local shoulder/hip root, with a progressively curved
muscular path out to the unchanged original feet. Existing four hip
sockets, gait channels, claws, water physics and three form scales remain.
Paired left/right regression tests assert embedded first control rings.
Visual acceptance requires new real WebGL close-ups; avoid claiming the
disk seams are fully resolved until review.

### Actual QA feedback: over-raised wing bones (5e04af5)
Real SwiftShader screenshots from
[45080194645](https://github.com/DocDamage/Scaleborn/actions/runs/45080194645)
showed the rest-fold phalanges raised like two oversized branches behind
the giant rider, after the `f2b651a` upward bend fix. This is a confirmed
regression despite passing automated geometry tests. The correction now tucks
the three skinned bones at a restrained +0.055/+0.030/+0.012 radian mirrored
dorsal bend, shortens the resting bind pose to 44% along span/chord,
65% vertically, and raises the attachment 15 cm into the dorsal contour.
All form physics and named bones are unchanged. Needs new real screenshot
confirmation; visual acceptance remains BLOCKING.

### Onyx face silhouette correction from actual side WebGL imagery
Current real side captures show a bulky blunt reptile/hippo-shaped snout even
after the organic skull loft and brow/cheek work. The original Onyx skull
profile now closes the very front surface to a ~16mm wide tapered tip,
keeps the measured eye/orbit/cheek/horn locations intact, and introduces a
subtle narrower lower-jaw wedge. This replaces the large front elliptical
opening without adding separate sphere/cone parts or changing the root
physics/gameplay form dimensions. Require fresh real side/front screenshots
in small/rideable/giant forms; no final art approval.


### Real WebGL review — b2327cd, updated folding, rider hands and embedded legs

The [actual 1280×720 character capture](https://github.com/DocDamage/Scaleborn/actions/runs/45080729284)
completed successfully with all 11 independent/mounted/on-foot/dragon-form
views. Compared against the prior giant and rideable side shots
[45080194645](https://github.com/DocDamage/Scaleborn/actions/runs/45080194645):

- **Verified improvement:** resting folded wing fingers now run roughly
  horizontally along Onyx's mid-back, no longer towering above the rider or
  stabbing down toward the ground.
- **Verified improvement:** the distracting pale circular upper-leg cap
  exposures are substantially reduced; the inward-rooted original limbs
  transition more quietly into the body.
- **Verified improvement but not production-ready:** the original heroine has
  actual slender finger/thumb forms and the cloak now displays a shaped
  draping silhouette rather than only a featureless hanging rectangle.
- **Still blocking:** the flattened pale folded-wing ribs resemble long
  mechanical strips rather than naturally folded biological cartilage;
  Onyx's skull and pupils are still cartoonlike, and the girl's face, rigid
  sleeve and full-body motion remain too procedural for acceptance.

The next high-detail original source painting sample and revised cranial loft
were authored as real code; actual subsequent WebGL snapshots, hardware
performance and user sign-off remain necessary. **PR #15 stays draft.**

### Matte indigo wing-membrane tuning from real folded-wing screenshot
Real full-form WebGL side captures show the fully folded painted membranes as
pale silver strips against Onyx's dark navy hide. The original MeshPhysical
material now uses higher roughness, lower clearcoat/metallic glints, a deeper
blue sheen and half-strength iridescence, retaining deterministic per-vertex
pigment, existing UV vein relief and the original three-bone fold morph.
This is a *real in-game* PBR surface change, not an extra shader pass or
generated concept art. Must compare actual daylight and in-flight captures
before visual signoff; quality gate stays BLOCKING.

### Original Onyx open wing real-flight QA camera
The DEV/qa-only character capture script can now position the live rideable
Onyx 12m above the meadow with actual flight pose and opened/skinned wings
(plus the unscaled mounted child), saving
`artifacts/characters-onyx-flight.png`. This adds an open-flight visual
counterpart to the close-up and ground-fold screenshots, catching accidental
wing material/normal/rig regressions that upright ground shots cannot reveal.
No new runtime controls, collision or gameplay features; real WebGL rendering
still must be inspected before visual signoff.
