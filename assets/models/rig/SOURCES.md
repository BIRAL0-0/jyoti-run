# Character rig & animation library — provenance

| | |
|---|---|
| Files | `Med_MovementBasic.glb`, `Med_MovementAdvanced.glb`, `Med_General.glb` (animation-only GLBs, `Rig_Medium` skeleton), `mannequin.gltf` + `mannequin.bin` + `mannequin_texture.png` (reference rig) |
| Upstream | https://github.com/sketchpunklabs/kaykit_char (branch `main`) |
| Original author | Kay Lousberg — *KayKit Character Animations* https://kaylousberg.itch.io/kaykit-character-animations |
| License | **CC0 1.0 Universal** (public domain dedication) — see `LICENSE` in this folder |
| Fetched by | `.harness/art/fetch-kaykit-rig.sh` |
| Tarball sha256 | `bdbee321f72c7efd3c5ea744f3e02f0b2d43d7f949c10ba2c7de5fe9c94c833b` |
| Modified? | **No** — the GLB/glTF bytes are upstream, unmodified. The animation clips were re-exported from FBX to GLB by the upstream repo (meshes removed) to keep the files small. |

The game *does* modify the rig in the sense the project brief asks for: the
bodies skinned onto these bones are authored in `js/characters/` (student
uniform, teacher saree/blazer, hair, props), and the clips are re-timed,
blended and layered with procedural poses (the bending slide). See
`research/CHARACTER_SYSTEM_PLAN.md`.

Only three of the eight upstream clip packs are vendored — the ones a runner
needs. Re-run the fetch script to pull more (`Med_Simulation`,
`Med_Special`, `Med_Tools`, `Med_CombatMelee`, `Med_CombatRanged`).
