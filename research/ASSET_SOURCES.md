# Open-source asset sourcing — Phase 3 (3D characters)

Log of what was actually reachable from the build sandbox and what was chosen.
Every claim below was measured with `curl`/`gh`, not assumed.

## 1. Network reachability (measured)

| Endpoint | Result | Note |
|---|---|---|
| `cdn.jsdelivr.net` | **blocked** | `SSL_ERROR_SYSCALL` — the game's runtime CDN |
| `unpkg.com`, `esm.sh` | **blocked** | empty reply |
| `threejs.org` | **blocked** | `SSL_ERROR_SYSCALL` (no `Soldier.glb` etc.) |
| `quaternius.com`, `kenney.nl`, `poly.pizza` | **blocked** | the usual CC0 model hosts |
| `raw.githubusercontent.com`, `media.githubusercontent.com` | **blocked** | so no single-file raw fetch, no Git-LFS media |
| `registry.npmjs.org` | ✅ | npm tarballs work |
| `github.com`, `api.github.com` | ✅ | search + API |
| **`codeload.github.com`** (repo tarballs) | ✅ | the one route to real asset bytes |

Consequence: the only way to get open-source **character** assets here is a
plain-git (non-LFS) GitHub repo fetched as a tarball. `@pmndrs/assets` (npm,
CC0) was downloaded and inspected — it contains bunny/suzi/matcaps/HDRIs, **no
characters**, so it was rejected.

## 2. Chosen asset — KayKit "Universal Rig" (CC0-1.0)

| | |
|---|---|
| Repo | `sketchpunklabs/kaykit_char` (branch `main`, plain git, no LFS) |
| Original author | **Kay Lousberg** — *KayKit Character Animations*, https://kaylousberg.itch.io/kaykit-character-animations |
| License | **CC0 1.0 Universal** (public-domain dedication) — `LICENSE` verified to contain "CC0 1.0 Universal" before copy |
| Fetched by | `.harness/art/fetch-kaykit-rig.sh` (re-runnable, sha256 logged in `assets/models/rig/SOURCES.md`) |

What we vendored into `assets/models/rig/` (bytes unmodified):

| File | Contents |
|---|---|
| `Med_MovementBasic.glb` | 11 clips: `Running_A/B`, `Jump_Full_Short/Long`, `Jump_Start`, `Jump_Land`, `Jump_Idle`, `Walking_A/B/C`, `T-Pose` |
| `Med_MovementAdvanced.glb` | 13 clips: `Crouching`, `Crawling`, `Dodge_*`, `Sneaking`, `Running_Strafe_*`, `Walking_Backwards`, `T-Pose` |
| `Med_General.glb` | 15 clips: `Idle_A/B`, `Hit_A/B`, `Death_A/B`, `PickUp`, `Throw`, `Interact`, `Spawn_*`, `T-Pose` |
| `mannequin.gltf` + `.bin` + `_texture.png` | the reference body mesh (not used at runtime; kept for proportions) |

The packs total 139 clips upstream; we vendor the 39 a runner needs. Re-run the
fetch script to pull the combat/simulation/tools packs.

## 3. Rig facts (verified with `.harness/tools/*`)

* **23 bones**, names sanitized by `GLTFLoader` (`upperarm.l` → `upperarml`).
  Our skeleton must use the *sanitized* names so the mixer binds tracks.
* Hierarchy `Rig_Medium → root → hips → spine → chest → {head, arms}`, legs off
  `hips`. `root` carries a −90° X (Blender Z-up → Y-up); GLTFLoader leaves the
  imported tree already Y-up (bind `hips` worldY ≈ 0.406).
* Bind-pose crown ≈ 1.24 rig units; we scale the whole character group to the
  game's world height (`PLAYER.SPRITE_HEIGHT`). Verified in
  `probe-skin-scale.mjs` that a uniform parent scale on a co-assembled
  `SkinnedMesh` + `Skeleton` applies **exactly once** (no double-scale).
* Clips are **in-place** (`root` translation stays 0; the hips do the bob), so
  they retarget onto our authored bodies with no root-motion cleanup.
* The 3 `Rig_Medium.*` tracks per clip target the armature wrapper node; we
  strip them (harmless — it never moves) to silence `PropertyBinding` warnings.
* `Crouching` only drops the crown 1.24 → 1.13 — **not** a slide. This is why
  the slide is a **procedural bend layer** on top of the mixer (see
  `CHARACTER_SYSTEM_PLAN.md` §3.1), not a clip swap.

## 4. Licensing summary

All character motion is **CC0** — no attribution required (we credit Kay
Lousberg anyway in the README and `SOURCES.md`). The bodies skinned onto the
rig, their textures, and the slide/bend choreography are original work for this
project, MIT like the rest of the repo.
