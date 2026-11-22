# G4 combat foundation — first playable encounter

**Status: implementation slice; G4 is not complete.** Preserve the visual-quality hold in `docs/VISUAL_QUALITY_GATE.md`. Original generated enemies and flame effects are a functional implementation, not approved final painterly combat art.

## Try the encounter

Open `/?start=combat` (optionally `&quality=low`) and click **Take flight**. This stages a mounted Onyx on safe land facing the three original Gloam hounds east of the Tidegate meadow. Normal play can reach the same hounds around **(-410, -45)**. Press **R** or primary mouse button with pointer lock for directional fire breath while controlling Onyx, or a narrower Tidal Sigil while controlling the rider. **X** triggers a short-range coordinated surge only when both companions are on dry land within 8 meters. Turn with A/D or mouse, watch the plume, and aim at the creatures; the cone has bounded width/range, respects actual terrain occlusion, and cannot hit behind the dragon. Fire and Tidal Sigil projectiles follow a modest upward arc and compensate for local terrain elevation while the caster is grounded, so gentle uphill slopes do not swallow an otherwise valid shot. Large terrain ridges still block line of fire. In flight, attacks retain strict pitch-based three-dimensional aiming; the pooled WebGL effects use the same lifted, ground-following behavior.

- Breath consumes a regenerating **Ember** pool; attacks have a 0.78-second cooldown. Small, rideable and giant forms have different reach and damage. Swimming, rider focus and active traversal transitions cannot breathe fire.
- The independent rider casts a directional **Tidal Sigil** with the same R input and a separate regenerating **Focus** pool. Both actors must be grounded and close (8 m) to perform **X · Bond Surge**, an area attack consuming both reserves with a 6.5-second cooldown. A shared HUD bar displays the active actor's energy without adding a third permanent panel.
- Gloam hounds pursue ground/low-air targets inside a finite aggro radius, stop at terrain blockers, wind up before melee, recoil when hit and leash home. High flying or diving escapes melee; their hit reaction and deaths have visible feedback.
- Clearing all three threats grants one permanent-for-session **+15 maximum Ember** improvement and a full Ember refill. The reward is awarded once and is not yet part of the G5 save format.
- **Bond vitality** is shared between rider and dragon for this first slice. Repeated strikes can exhaust it. Defeat returns both safely to the Tidegate meadow with a short grace period, while preserving quest/discovery progress and already banished hounds. Encounter state is session-only until G5 save slots.
- The minimal two-bar display appears only near living threats or when vitality/ember is below full. It does not resurrect cluttered old HUD panels.

## Code boundaries and validation

- `src/combat/combat.ts`: renderer-independent fixed-step combat, directional damage, terrain occlusion, cooldown/resource math, enemy AI, telegraph, hit immunity, checkpoint recovery.
- `src/combat/visuals.ts`: original code-sculpted Three.js enemy and pooled fire-breath visuals, with stable enemy IDs and disposal. Meshes never determine gameplay hits.
- `src/app/game.ts`: composition + input, HUD and pause alignment.
- `src/combat/houndNavigation.ts`: deterministic local sidestepping with midpoint/end clearance, bounded step heights and pack separation; this is not full navmesh pathfinding.
- `tests/combat.test.ts` and `tests/combatVisual.test.ts`: deterministic regression tests. Run `npm run check`.
- `npm run test:combat-browser`: Playwright/SwiftShader battle QA against a running Vite server, using real combat keyboard input, read-only damage snapshots and dev-only actor placement. Captures Gloam Den, flame, rider sigil and bonded surge screenshots. GitHub Actions uploads the PNGs as `scaleborn-g4-webgl-combat`. **Software WebGL does not validate painterly production quality or target-GPU frame rate.**

## Next G4 work (not yet delivered)

Additional threat archetypes/behaviors, encounter reward and checkpoint migration, enemy navigation improvements, authored impact/sound/facial/animation sets, targeting/accessibility options, and real RTX 3060 profiling/screenshot acceptance. Initial rider sigil/bond burst logic is functional but still needs browser gameplay acceptance and animation polish.

### Actual-screen review: bonded surge VFX correction

The first integrated gameplay screenshot showed an unnatural over-bright
burst of long white spikes covering the screen. The combat adapter now uses
36 **feathered, alpha-textured, terrain-hugging painted energy petals** in
one instanced draw batch, with blue/teal/amethyst palette variation and
bounded, non-additive luminosity. Animated radial spread remains tied to
the real 15-metre Bond Surge gameplay event, without changing target damage,
range, cooldowns, or save state. Runtime updates reuse one buffer and shader
material. Regression tests prevent reintroducing tall cone spikes, flat
opaque textures or unbounded off-terrain particles.

This is a visual improvement in the game, not a final VFX art acceptance.
Review the next real browser capture and RTX 3060 performance.

### Gloam hound anatomical visual refinement

The first real G4 screenshots showed the small enemies as dark sphere stacks.
The Gloam hound now has a continuous original tapered wolf-like torso/muzzle,
four smooth pivoted legs and rounded paws, swept ears, curved ridge quills,
and a deterministic original pelt-normal map. The existing AI state machine,
attack cues, hit volumes, positions, named actors and enemy HP remain
unchanged. This is actual in-game procedural geometry, not a stock creature.
The unified mesh has UV/normal data and explicit disposal; tests cover its
geometry, material and all three live enemies.

Final character art, polished animation and real GPU frame times still need
review before the playable quality gate is accepted.

### Onyx directional breath visual repair

Live G4 screenshots showed fire as hard, over-exposed triangle/cone
geometry rather than a flowing painted flame. The existing 54 pooled
projectile visuals now draw narrow crossed **alpha-feathered fire ribbons**
with coherent taper/soft ends. Original palette gradients remain, while
non-additive blending and moderated emissive light prevent white clipping.
Damage, hit direction, cooldown, resource cost, terrain occlusion and
underwater restrictions are unchanged. The textures, geometry and runtime
pool remain bounded and disposable.

This is a better in-game effect, not an authored final VFX sequence.

### Mounted Tidal Sigil — playable G4 extension

T or the controls-panel button casts the existing heroine's Tidal Sigil
from either rideable or giant Onyx, using **Focus**, not Ember. The original
R fire attack is unchanged. Mounted and dismounted sigils share cooldown,
Focus reserves, directional checks, terrain occlusion and hit registration.
Grounded shots follow terrain; airborne shots use pitch and can miss.
Swimming, small-form, rider-control and transition exploits are rejected.
The existing combat HUD reports remaining Focus beside Ember while mounted.
This extends G4 combat but is not a complete mounted melee or lock-on system.

### Persistent Gloam Den victory (backward-compatible Azure Coast v1)

The existing Azure Coast progress payload now includes an additive boolean
`gloamCleared` and defaults it to false for older version-one saves. On
reload, the three original Gloam hound identities remain defeated and the
earned +15 maximum Ember is restored once without replaying the kill notice.
Victory persists directly from the successful R/T/X combat action; if local
storage is blocked, play continues and the write is retried on future actions.
The existing Tidegate, Tidal Echo and discovery milestones retain their
current key, schema version and validation behavior. This does not yet
implement multiple save slots or equipment/inventory progression.

### Ground claw swipe (G4 extension)

Onyx now uses **Z**, or the existing controls menu, for a forward-facing
melee claw sweep on the ground. Damage and reach scale by form; solid terrain,
line-of-sight, cooldown, direction and target height gate actual damage.
The strike uses the same hound damage/stagger/death pipeline and Gloam reward,
with an independent 0.94-second recovery and no Ember cost. Onyx's existing
front-leg/claw pivots perform a time-bounded swing without changing
physics or the flight simulation. Airborne, submerged, rider-control and
mid-transition strikes are rejected. This is a working first melee attack,
not complete bite, tail-combo, boss combat or animation-matched hit windows.
