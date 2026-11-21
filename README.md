# Scaleborn

**Scaleborn** is an original painterly 3D fantasy adventure about a 13-year-old dragon-human hybrid and her bonded dragon. The project begins with a **desktop-browser Azure Coast flight prototype** and is structured for a later **Unreal Engine implementation**. Browser gameplay will not automatically transfer to Unreal.

## Current state: early G0/G1 foundation (not the complete game)

This branch contains a playable **first-flight preview**: an original code-generated dragon and rider, deterministic Azure Coast terrain streamed in tiles, ocean, cloud banks, trees, coastal rocks, generated harbor cottages and piers, lighthouse, simple assisted flight and multiple cameras. It does **not** yet include combat, on-foot controls, swimming, underwater exploration, transformation, quests, saves, audio, asset-export tooling or finished painterly textures. These remain planned work, not hidden or simulated features.

The 4 × 4 km world and all objects use meters with Y up. The packaged seed is `0x5ca1e0`. Geometry is procedurally generated and currently requires no third-party art/audio files.

## Running locally

Requires Node.js 20+ and npm.

```bash
npm install
npm run dev
```

Open the URL printed by Vite. Click **Take flight**. Press Esc to release pointer lock. Run `npm run check` for lint/unit/build checks and `npm run build` to produce the deployable `dist/` directory. An npm lockfile has **not yet** been checked in; dependency pinning uses exact direct versions until the lockfile is generated and verified.

| Control | Effect |
| --- | --- |
| W / S | Climb / dive |
| A / D | Turn left / right |
| Mouse (when captured) | Pitch / steer |
| Q / E | Bank |
| Shift | Speed surge |
| Space | Stronger wingbeat / increased cruise speed |
| V | Cycle five cameras |
| H | Toggle controls panel (pauses preview) |
| F3 | Toggle seeded-world and renderer diagnostics |

## Milestone order

- **G0** — architecture, strict TypeScript, Vite, lint/tests/build, seeded generation and asset registry. Lockfile and smoke/benchmark verification remain.
- **G1** — painterly Azure Coast, recognizable landmarks, world-streaming quality/LOD, water, foliage and coastal architecture. **Early draft**, not art-complete.
- **G2** — polished flight dynamics, original procedural dragon/rider rigs, expressive animation and all three dragon sizes. **Early input/flight prototype only**.
- **G3** — seamless on-foot, riding, swimming and underwater traversal, co-op exploration.
- **G4** — fire/elemental combat, threats and rider/dragon bond interactions.
- **G5** — story opening, villages/NPCs, quests, progression and persistent saves.
- **G6** — optimization, replacement art pipeline, accessibility, packaging and Unreal port plan.

See `docs/ARCHITECTURE.md` and `docs/MILESTONES.md` for contracts, omissions and acceptance gates.
