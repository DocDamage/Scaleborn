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
