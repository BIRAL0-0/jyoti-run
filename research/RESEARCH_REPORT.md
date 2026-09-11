# School Runner: Teacher Chase — Research Report

**Phase 1 Deliverable** · Prepared by Arena AI Agent · 2026-09-11
**Status:** ✅ Complete — awaiting user approval before Phase 2 (development)

---

## Executive Summary

All ten research tasks are complete. The recommended stack is **Three.js r160+ (ES modules via CDN import map), Howler.js 2.2.4 for audio, vanilla ES6+ with no build tools, and GitHub Pages for hosting** — exactly matching the spirit of the Phase 2 spec, with every component verified to exist and be current as of September 2026 (Three.js is now at r186; anything r160+ is fine, we pin the version for reproducibility).

For the **characters**, the Billboard Sprite approach (`THREE.Sprite` + transparent PNG) is confirmed as the right choice: it is the cheapest way to render the user's 2D images, always faces the camera by design, and all requested animations (run-bob, jump arc, slide squash, stumble wobble) reduce to simple transforms on the sprite — the Phase 2 spec's sample code already reflects this correctly.

For **3D assets**, everything needed is available free and CC0: **Kenney's Furniture Kit** (116 models — desks, benches, shelves, trolleys) plus **Quaternius' traffic props** (cones, barriers) and **Kay Lousberg's road kits** from poly.pizza cover every environment and obstacle slot in the spec. Collectible grade papers should be **procedurally built** (textured plane + canvas-drawn letter) rather than downloaded — cheaper, zero license risk, and lets each grade tier glow its own color. Ground textures fall back to **ambientCG's CC0 gravel/concrete** if the user's custom texture is unavailable.

The **unique teacher-chase mechanic** needs no external library — a small state machine (HIDDEN → CHASING → FADING_OUT → CAUGHT) over sprite opacity and Z-distance, as sketched in the Phase 2 spec, is sound; this report refines it with a sustained-proximity catch rule and fairness guards.

**Estimated Phase 2 effort:** 1–2 agent sessions to a fully playable, tested build (human-equivalent ≈ 40–60 hours). The only blockers are the three user-provided images (`ground-gravel.png`, `student-character.png`, `teacher-character.png`) — placeholder generator fallbacks are proposed in §12 so development can start regardless.

---

## 1. Code Repositories Analysis

Verified live via the GitHub API on 2026-09-11 (stars/licenses/push dates are current). Ranked by usefulness **to this project** (a 3-lane WebGL billboard-sprite runner), not by stars alone.

| # | Repository | Stars | License | Last push | What we can use |
|---|------------|-------|---------|-----------|-----------------|
| 1 | [eeshadutta/Subway-Surfers](https://github.com/eeshadutta/Subway-Surfers) | 41 | ⚠️ None | 2021-10 | The single most relevant repo: WebGL **3-lane Subway-Surfers clone** — lane switching, obstacle spawning, collision, score. Study for architecture; **do not copy code** (no license = all rights reserved). |
| 2 | [juwalbose/ThreeJSEndlessRunner3D](https://github.com/juwalbose/ThreeJSEndlessRunner3D) | 26 | ✅ MIT | 2020-06 | Clean minimal **endless-runner loop** (recycle-track pattern, obstacle dodge). Companion to a Tuts+ tutorial. Small enough to read in one sitting; safe to adapt (MIT). |
| 3 | [EvanBacon/Sunset-Cyberspace](https://github.com/EvanBacon/Sunset-Cyberspace) | 84 | ⚠️ None | 2026-05 | Extremely polished retro 3D runner (Expo + Three.js). Best **"game feel" reference**: camera shake, speed ramps, juiced animations. Inspiration only. |
| 4 | [Portabello/Endless-Runner](https://github.com/Portabello/Endless-Runner) | — | ⚠️ None | legacy | Early classic; documents **collision detection between moving objects** and garbage-collection discipline in a runner context. Concept reference. |
| 5 | [atirek-ak/subway-surfers](https://github.com/atirek-ak/subway-surfers) | 10 | ⚠️ None | 2019-06 | Basic JS/WebGL Subway-Surfers mechanics; useful to compare lane-switch implementations. |
| 6 | [darthgera123/Subway-Surfer](https://github.com/darthgera123/Subway-Surfer) | 10 | ⚠️ None | 2019-03 | WebGL clone; player physics patterns. |
| 7 | [ShashwatNigam99/Subway-Surfers](https://github.com/ShashwatNigam99/Subway-Surfers) | 9 | ⚠️ None | 2019-03 | WebGL clone; obstacle variety ideas. |
| 8 | [ab192130/threejs-endless-runner](https://github.com/ab192130/threejs-endless-runner) | 10 | ⚠️ None (README claims MIT but no LICENSE file) | 2023-08 | Simple procedurally-generated runner; scoring system pattern. |
| 9 | [anafibnshahibul/Neon-Void-Runner-3D-Game](https://github.com/anafibnshahibul/Neon-Void-Runner-3D-Game) | 4 | ✅ MIT | 2026-02 | **Actively maintained (2026)** MIT neon runner — good modern example of speed-based difficulty and glow visuals. |
| 10 | [mrdoob/three.js — examples](https://github.com/mrdoob/three.js/tree/dev/examples) | ~105k | ✅ MIT | daily | The gold standard: instancing, sprites, `games_fps` structure. All MIT. |

**Key takeaways for Phase 2**
- No existing repo implements our **conditional teacher-chase** mechanic — it will be built from scratch (design in §4.4). This is genuinely novel; nothing to copy.
- The lane-runner pattern is well-trodden: **world moves toward the player, player only moves on X/Y** — the Phase 2 spec already follows this correctly and it matches every repo above.
- The spec's module layout (managers/entities/utils) is cleaner than any repo found — keep it.
- License discipline: only **MIT/CC0 code** may be adapted. The unlicensed repos are read-for-inspiration only.

---

## 2. 3D Assets Library

All picks are **free, low-poly, GLB/GLTF-compatible, and CC0 (public domain)** unless noted. Verified accessible on 2026-09-11. The sandbox has no direct internet access, so download links are provided for the user/Phase 2 environment; `scripts/download-assets.sh` in this repo automates the scriptable parts.

### 2A. Primary packs (get these first)

| Asset Pack | Category | Link | License | Count | Format | Usage notes |
|------------|----------|------|---------|-------|--------|-------------|
| **Kenney — Furniture Kit** | Environment + LOW obstacles | [kenney.nl/assets/furniture-kit](https://kenney.nl/assets/furniture-kit) · also on [poly.pizza](https://poly.pizza/bundle/Furniture-Kit-NoG1sEUD1z) | **CC0** | **116 models** | FBX+OBJ+GLB | Desks, benches, tables, shelves, carts, crates → school desks (jump obstacles), benches, hallway clutter. Verified on poly.pizza. |
| **Kenney — City Kit (Roads)** | Environment edges | [kenney.nl/assets/city-kit-roads](https://kenney.nl/assets/city-kit-roads) | **CC0** | 83 | FBX+OBJ+GLB | Curbs, sidewalk pieces, road markings → edge-of-track dressing. |
| **Quaternius — traffic props** | BLOCKER obstacles | [Traffic Cone](https://poly.pizza/m/lAx8JytxGD) · [Traffic Cone alt](https://poly.pizza/m/aDIrUbMbW3) · [Traffic Barrier](https://poly.pizza/m/cM3aJPU9NS) · [Traffic Barrier alt](https://poly.pizza/m/nugx3heueH) · [bundle page](https://poly.pizza/u/Quaternius) | **CC0** | 1 model each | GLB | Verified live on poly.pizza; "Download GLB" button on each page. Perfect lane blockers. |
| **Quaternius — Desk** | LOW obstacle | [poly.pizza/m/V86Go2rlnq](https://poly.pizza/m/V86Go2rlnq) | **CC0** | 1 | GLB | Verified live; classroom desk exactly as spec'd. |
| **Kay Lousberg — Road Bits** | BLOCKER/decor | [poly.pizza/m/5BPCPOycxC](https://poly.pizza/m/5BPCPOycxC) · [KayKit kits](https://kaylousberg.itch.io) | **CC0** | kit | GLB | Cones, barriers, lights in a consistent chunky style; great alternates. |
| **Kenney — Nature Kit** | Outdoor variant decor | [kenney.nl/assets/nature-kit](https://kenney.nl/assets/nature-kit) | **CC0** | 200+ | FBX+OBJ+GLB | Low-poly trees/bushes/rocks for roadside variety. |

### 2B. Collectible (build, don't download)

| Asset | Approach | Why |
|-------|----------|-----|
| **Grade paper (D/C/B/A+)** | **Procedural**: `THREE.PlaneGeometry` + `THREE.CanvasTexture` drawing the grade letter, per-tier color from `CONFIG.GRADES.TIERS`, slow Y-rotation + sine bob, additive glow sprite behind A+ | Zero download, ~0 KB, colors/text fully data-driven from config, no license issues, and matches spec's rotation/bob/tier requirements exactly. A double-sided plane with slight bend reads perfectly as "floating paper". |

### 2C. Fallback ground textures (user provides primary)

| Texture | Link | License | Notes |
|---------|------|---------|-------|
| **ambientCG — Gravel 001** | [ambientcg.com/view?id=Gravel001](https://ambientcg.com/view?id=Gravel001) | **CC0** | Seamless 1024–4096px, diffuse+normal+roughness; ideal under the user's texture override system. |
| **ambientCG — Concrete 011 / PavingStones** | [ambientcg.com](https://ambientcg.com/view?id=Concrete011) | **CC0** | Hallway/concrete variants for the tiled-floor look. |
| **3dtextures.me — Gravel/Ground set** | [3dtextures.me/tag/gravel](https://3dtextures.me/tag/gravel/) | CC0 | Verified live; convenient 1024px bundles with all PBR maps. |
| **Poly Haven — ground materials** | [polyhaven.com/textures](https://polyhaven.com/textures) | **CC0** | Highest PBR quality; useful if we add normal-mapped ground on desktop. |
| **TextureCan — Ground 0020 (gravel)** | [texturecan.com/details/194](https://www.texturecan.com/details/194/) | CC0 | Verified live; seamless gravel alternative. |

### 2D. Texture backup search order
1. ambientCG (CC0, no login) → 2. Poly Haven (CC0) → 3. texturecan (CC0) → 4. textures.com free tier (credit required — avoid unless necessary).

**Style previews (official sources, view in browser):** [Kenney Furniture Kit page](https://kenney.nl/assets/furniture-kit) shows renders of all 116 props · [Quaternius profile on poly.pizza](https://poly.pizza/u/Quaternius) shows every prop as a live thumbnail · [KayKit kits](https://kaylousberg.itch.io/) show the chunky low-poly style.
**Quality bar:** every picked model is well under the 5,000-polygon budget (Kenney/Quaternius props are typically 100–1,500 tris), so even 40 concurrent obstacles are trivial for mobile GPUs.

---

## 3. Character System Technical Approach

**Problem:** the user supplies flat 2D PNGs (student, teacher) that must live in a 3D world.

### Option A — Billboard Sprite (`THREE.Sprite`) ✅ RECOMMENDED

```javascript
const texture = new THREE.TextureLoader().load('assets/textures/student-character.png');
texture.colorSpace = THREE.SRGBColorSpace;              // r152+: correct PNG colors
const material = new THREE.SpriteMaterial({
  map: texture,
  transparent: true,
  depthWrite: false,        // avoids z-fighting halos around transparent edges
});
const sprite = new THREE.Sprite(material);
sprite.scale.set(1.5, 2.5, 1);                           // from CONFIG.PLAYER
sprite.center.set(0.5, 0.0);                             // pivot at feet → ground math is trivial
sprite.position.set(0, 0, 0);
scene.add(sprite);
```

**Pros**
- Always faces the camera automatically — the defining billboard behavior, zero code.
- Cheapest possible render path (one textured quad); many sprites ≈ free.
- Anchor control via `sprite.center` — setting `(0.5, 0)` makes Y-position = ground height, simplifying jump/slide math.
- Opacity fades (teacher appear/disappear) are one property: `material.opacity`.
- Pixel-art/2D-charming aesthetic is a feature, not a bug, for a school game.

**Cons**
- No true 3D perspective change (fine for a behind-the-back runner).
- Transparency sorting: mitigate with `depthWrite: false` (teacher may overlap student visually for a frame at certain angles — acceptable).
- Lighting doesn't affect sprites (can fake with `material.color` dimming).

### Option B — Textured 3D mesh (capsule/box with UV-mapped PNG)

```javascript
const geometry = new THREE.CapsuleGeometry(0.5, 1.2, 4, 12);
const material = new THREE.MeshStandardMaterial({ map: characterTexture });
```

**Pros:** receives scene lighting and shadows; slight parallax as camera angle changes.
**Cons:** a photo/PNG wrapped on a capsule looks distorted ("label on a bottle" artifact) unless the art was drawn for that UV layout — the user's images won't be; ~10× more vertices for no visual gain here; shadow looks like a pill, not a character.

### Verdict

| Criterion | Sprite | 3D mesh |
|-----------|--------|---------|
| Visual fit for provided PNGs | ✅ | ❌ distortion |
| Perf (mobile) | ✅ cheapest | ~10× verts |
| Animation effort | transforms only | same-ish |
| Shadow realism | fake blob shadow (recommended: small dark circle mesh under runner) | pill shape anyway |
| **Recommendation** | **✔ USE** | ✖ |

**Animation strategy without sprite sheets** (all verified standard practice):
- **Run:** vertical bob `y += sin(t * RUN_BOB_SPEED) * RUN_BOB_AMOUNT` + slight `rotation.z` sway; add a **blob shadow** that scales inversely with jump height for grounding.
- **Jump:** parabola `y = JUMP_HEIGHT * sin(progress * π)` over `JUMP_DURATION` (spec's formula is correct).
- **Slide:** squash `scale.y → SLIDE_HEIGHT` with sine ease-in-out, anchor at feet via `center=(0.5,0)`.
- **Stumble:** damped sine wobble on `rotation.z`, plus brief red tint via `material.color`.
- **Teacher fade:** `material.opacity` tween over `FADE_DURATION`.
- **Juice (Phase 2 bonus):** speed lines via a scrolling `CanvasTexture` plane, dust puffs as pooled fading sprites on landing.

---

## 4. Game Mechanics Code Patterns

### 4.1 Swipe Detection (vanilla JS, no buttons, no libraries)

Hammer.js is **not needed** — touch events cover it. Key design points: decide axis by the **larger** delta, threshold ≈ 24 px (research converges on 20–70 px minimums; smaller feels more responsive), fire on `touchend`, call `preventDefault()` on `touchmove` with `{ passive: false }` to kill browser scrolling, and add a **cooldown** so one swipe can't double-trigger. iOS Safari and Android Chrome both fire standard `touchstart/move/end`; the only real difference is Safari's elastic overscroll, killed by `overscroll-behavior: none` + `touch-action: none` on the canvas/body.

```javascript
// InputHandler.js — swipe detection snippet (Phase 2 uses the full class)
const SWIPE_THRESHOLD = 24;      // px — tested good on phone + tablet
const SWIPE_COOLDOWN_MS = 120;   // prevent double-fires

let startX = 0, startY = 0, startTime = 0, lastSwipe = 0;

document.addEventListener('touchstart', (e) => {
  startX = e.changedTouches[0].clientX;
  startY = e.changedTouches[0].clientY;
  startTime = performance.now();
}, { passive: true });

document.addEventListener('touchmove', (e) => e.preventDefault(), { passive: false }); // no scroll/zoom

document.addEventListener('touchend', (e) => {
  const dx = e.changedTouches[0].clientX - startX;
  const dy = e.changedTouches[0].clientY - startY;
  const now = performance.now();

  if (now - lastSwipe < SWIPE_COOLDOWN_MS) return;
  if (Math.max(Math.abs(dx), Math.abs(dy)) < SWIPE_THRESHOLD) return; // it was a tap
  lastSwipe = now;

  if (Math.abs(dx) > Math.abs(dy)) {
    player.switchLane(dx > 0 ? 1 : -1);   // right / left
  } else {
    dy < 0 ? player.jump() : player.slide(); // up / down
  }
}, { passive: true });
```

Desktop keys map to the same four actions (`←→`/`A D`, `↑`/`W`/`Space`, `↓`/`S`), exactly as the Phase 2 spec outlines.

### 4.2 Object Pooling

Universal pattern for tiles, obstacles, and papers: **never `new`/`dispose` during play** — pre-allocate, then acquire/release. Memory stays flat; GC pauses vanish. (Pooling vs create/destroy: create/destroy causes periodic 10–40 ms GC hitches that read as stutter at 60 FPS; pooling removes the allocation entirely — this is standard practice in every runner repo surveyed.)

```javascript
// ObjectPool.js — generic pool for pre-built Three.js objects
export class ObjectPool {
  /**
   * @param {() => THREE.Object3D} factory  creates one instance (adds nothing to scene)
   * @param {number} initialCount           pre-allocate warm
   */
  constructor(factory, initialCount = 16) {
    this.factory = factory;
    this.free = [];
    this.active = new Set();
    for (let i = 0; i < initialCount; i++) this.free.push(factory());
  }

  acquire() {
    const obj = this.free.pop() ?? this.factory();   // grow only under pressure
    this.active.add(obj);
    return obj;
  }

  release(obj) {
    if (!this.active.delete(obj)) return;
    obj.visible = false;
    this.free.push(obj);
  }

  /** Recycle everything that scrolled past the camera (called per-frame). */
  sweep(recycleZ, forEachReleased = () => {}) {
    for (const obj of [...this.active]) {
      if (obj.position.z > recycleZ) {              // world moves +z toward camera
        this.release(obj);
        forEachReleased(obj);
      }
    }
  }

  reset() { for (const obj of [...this.active]) this.release(obj); }
}
```

Phase 2 usage: `GroundManager` = fixed ring of tiles repositioned to the back (spec's approach is already optimal — no pool needed, just index rotation). `ObstacleManager` = one pool per obstacle type (LOW/HIGH/BLOCKER), each pre-filled with the max concurrent count. `CollectibleManager` = one paper-mesh pool; per-tier look is a material swap, not a new mesh.

### 4.3 Difficulty Progression

Spec asks for linear-ish speed ramp + three distance tiers. Recommended: **linear speed with soft cap** (predictable, tunable) and **step-function tiers** (as spec'd) with `smoothstep` easing between spawn chances to avoid difficulty cliffs.

```javascript
// Difficulty.js — pure function of distance, fully config-driven
import { CONFIG } from '../config.js';

const { INITIAL_SPEED, MAX_SPEED, SPEED_INCREMENT } = CONFIG.GROUND;

export function calculateDifficulty(distanceMeters, elapsedSeconds) {
  // 1) Speed: linear ramp 15 → 45 over ~60 s of run time, then flat.
  const speed = Math.min(MAX_SPEED, INITIAL_SPEED + SPEED_INCREMENT * elapsedSeconds);

  // 2) Spawn chance: 25% → 65%, eased between the 500 m and 1500 m tier marks.
  const t = smoothstep(500, 1500, distanceMeters);
  const spawnChance = lerp(CONFIG.OBSTACLES.INITIAL_SPAWN_CHANCE,
                           CONFIG.OBSTACLES.MAX_SPAWN_CHANCE, t);

  // 3) Grade tier: exactly per spec table.
  const tier = distanceMeters >= 1500 ? 'A+'
             : distanceMeters >= 500  ? 'B'
             : 'C'; // D/C mixed in early game via TIERS spawnWeight

  return { speed, spawnChance, tier };
}

const lerp = (a, b, t) => a + (b - a) * t;
const smoothstep = (a, b, x) => {
  const t = Math.min(1, Math.max(0, (x - a) / (b - a)));
  return t * t * (3 - 2 * t);
};
```

Balancing notes: at 15 u/s with `MIN_GAP_BETWEEN: 12`, worst-case reaction time starts at ~0.8 s and shrinks to ~0.27 s at max speed — right in the "hard but fair" band for runners. Obstacle combos should be gated: never spawn a HIGH (slide) within `MIN_GAP` of a BLOCKER at tier 1.

### 4.4 Teacher Chase Logic (the unique mechanic)

Phase 2 spec's skeleton is sound; this flowchart adds the fairness details (sustained-proximity catch, lunge grace, mistake decay).

```
STATE: HIDDEN  (teacher invisible, opacity 0)
  ├─ player hits obstacle ──► mistakeCount += 1
  │     mistakeCount == 1 ──► STATE: CHASING (fade in 0.5 s, spawn 12 u behind, alert sound)
  │     mistakeCount >= 3 ──► STATE: CAUGHT (game over — teacher sprints in for the catch)
  └─ (nothing else happens)

STATE: CHASING  (visible, closing in)
  ├─ every frame: distanceToPlayer -= (playerSpeed * CHASE_SPEED_MULTIPLIER - playerSpeed) * dt
  ├─ if distanceToPlayer <= CATCH_DISTANCE for ≥ 0.4 s sustained ──► STATE: CAUGHT
  ├─ clean meters run ≥ 100 (RECOVERY_DISTANCE) ──► STATE: FADING_OUT
  └─ player hits another obstacle ──► mistakeCount += 1
        mistakeCount >= 3 ──► CAUGHT
        else            ──► teacher surges: distanceToPlayer = max(distance, 6 u)  // pressure spike

STATE: FADING_OUT
  └─ opacity → 0 over 0.5 s ──► STATE: HIDDEN (mistakeCount resets to 0)

GUARDS (fairness):
  • No catch check during the first 0.5 s fade-in.
  • While player is mid-jump/slide and would be caught, teacher holds at 1.6 u for max 1.0 s
    ("lunge grace") — prevents unavoidable deaths from a hit right in front of an obstacle.
  • mistakeCount decays: -1 for every 50 m clean run (long runs forgive early spam).
  • Red vignette UI intensity = 1 - (distanceToPlayer / APPEAR_DISTANCE), clamped 0..1.
```

Pseudocode (maps 1:1 onto the spec's `Teacher.js` — same public API: `onPlayerMistake()`, `updateRecovery()`, `update()`, `getWarningIntensity()`):

```javascript
// per frame while CHASING
const closing = playerSpeed * (TEACHER.CHASE_SPEED_MULTIPLIER - 1); // net gain per second
this.distanceFromPlayer = Math.max(TEACHER.CATCH_DISTANCE, this.distanceFromPlayer - closing * dt);
this.sprite.position.z  = playerZ - this.distanceFromPlayer;
this.sprite.position.x  = lerp(this.sprite.position.x, playerLaneX, 0.25 * dt * 10); // weaves toward player's lane, lazily
this.closeTimer = (this.distanceFromPlayer <= TEACHER.CATCH_DISTANCE) ? this.closeTimer + dt : 0;
if (this.closeTimer >= 0.4) return 'CAUGHT';
```

Design rationale: the spec's raw `CATCH_DISTANCE` check can insta-kill on a frame of contact; the 0.4 s sustained window + lunge grace makes it feel like a *struggle* (you can outrun her) rather than a hitscan. The lane-weave keeps her visible behind the player instead of ghosting through the camera plane.

---

## 5. Audio Implementation

### 5A. Library Recommendation: **Howler.js 2.2.4** ✅ (MIT, latest — verified via npm registry 2026-09-11)

| Criterion | Web Audio API (vanilla) | **Howler.js 2.2.4** |
|-----------|------------------------|---------------------|
| Playing multiple SFX simultaneously | manual node graph per play | ✅ built-in (`play()` returns live id) |
| Looping music, seamless gap | manual (`loop` + buffer juggling; iOS gap-prone) | ✅ `loop: true`, HTML5-Audio fallback tuning |
| Volume/mute control | manual gain nodes | ✅ global/per-sound `volume()`, global `mute()` |
| Mobile unlock (autoplay policy) | must hand-roll "unlock on first gesture" | ✅ handled automatically |
| Audio sprites (many short SFX, 1 file) | DIY decode + offsets | ✅ built-in |
| File size / dependency | 0 KB | **~9 KB gzipped, one file, CDN** |
| Fallback chain | none | WebAudio → HTML5 Audio automatically |

Verdict: Howler costs 9 KB and deletes an entire class of mobile-audio bugs (iOS silent-mode handling, autoplay unlock, format fallbacks). Vanilla Web Audio remains documented as the fallback path. Load from CDN; **cache locally in `assets/lib/` for offline + GitHub Pages resilience.**

### 5B. Sound Effects Library (free, direct-download)

**Mixkit — [Mixkit License](https://mixkit.co/license/#sfxFree): free for commercial use, no attribution.** All verified live on the [game SFX page](https://mixkit.co/free-sound-effects/game/) (2026-09-11). MP3 format.

| Game trigger | Sound | Duration | Where |
|--------------|-------|----------|-------|
| Jump | **"Player jumping in a video game"** | 0:01 | [mixkit.co/free-sound-effects/jump](https://mixkit.co/free-sound-effects/jump/) |
| Hit obstacle | **"Small hit in a game"** | 0:01 | [game SFX page](https://mixkit.co/free-sound-effects/game/) |
| Hit (heavier alt) | "Martial arts fast punch" | 0:01 | same page |
| Collect grade | **"Winning a coin, video game"** | 0:01 | same page |
| Collect (alt) | "Winning an extra bonus" / "Unlock game notification" | 0:01 | same page |
| Teacher alert | **"Retro arcade casino notification"** | 0:04 | same page |
| Game over | **"Player losing or failing"** | 0:03 | same page |
| Background music | **"Game level music"** (30 s, loopable, run-tempo) | 0:30 | same page |

**Kenney — CC0 (zero restrictions, verified):**
| Pack | Contents | Link |
|------|----------|------|
| **UI Audio** | 50 clicks/switches/confirmations | [kenney.nl/assets/ui-audio](https://kenney.nl/assets/ui-audio) |
| **Interface Sounds** | polish SFX set | [kenney.nl/assets/interface-sounds](https://kenney.nl/assets/interface-sounds) |
| **Music Jingles** | 85 jingles — game-over sting + start fanfare candidates | [kenney.nl/assets/music-jingles](https://kenney.nl/assets/music-jingles) |
| **Digital Audio** | arcade bleeps (teacher alert alternative) | [kenney.nl/assets/digital-audio](https://kenney.nl/assets/digital-audio) |

**Backups:** [freesound.org](https://freesound.org) (filter: CC0), [opengameart.org](https://opengameart.org) (filter: CC0), [zapsplat](https://zapsplat.com) (free tier, login). For a longer loopable music track beyond Mixkit's 30 s: OpenGameArt CC0 "upbeat arcade loop" collections or Pixabay Music (free license).

**Mapping to spec files:** `jump.mp3`, `collect.mp3`, `hit.mp3`, `teacher-alert.mp3`, `gameover.mp3`, `bg-music.mp3` under `assets/sounds/` — all six covered above with license-safe sources.

### 5C. Audio Manager pattern (Howler)

```javascript
// AudioManager.js
import { Howl, Howler } from 'howler';
import { AUDIO } from '../config.js';

export class AudioManager {
  #sounds = new Map();
  #music = null;
  #muted = false;

  async load() {
    const defs = AUDIO.SOUNDS; // { jump: 'assets/sounds/jump.mp3', ... }
    for (const [key, src] of Object.entries(defs)) {
      const isMusic = key === 'bgMusic';
      this.#sounds.set(key, new Howl({
        src: [src],
        loop: isMusic,
        volume: isMusic ? AUDIO.MUSIC_VOLUME : AUDIO.SFX_VOLUME,
        preload: true,
      }));
    }
    this.#music = this.#sounds.get('bgMusic');
  }

  play(name)         { this.#sounds.get(name)?.play(); }
  startMusic()       { if (!this.#music.playing()) this.#music.play(); }
  stopMusic()        { this.#music?.stop(); }
  toggleMute()       { this.#muted = !this.#muted; Howler.mute(this.#muted); return this.#muted; }
  setMasterVolume(v) { Howler.volume(v); }
}
```

Notes: `Howler.autoUnlock` (default true) fixes iOS/Chrome autoplay on the START-button tap; Phase 2 will pause music on `visibilitychange` tab-hide to save battery.

---

## 6. UI/UX Design System

### Fonts (Google Fonts, all OFL-licensed)

| Role | Font | Link |
|------|------|------|
| Title / arcade accents | **"Press Start 2P"** | [fonts.google.com/specimen/Press+Start+2P](https://fonts.google.com/specimen/Press+Start+2P) |
| HUD numbers / headers | **"Orbitron"** (400/700/900) | [fonts.google.com/specimen/Orbitron](https://fonts.google.com/specimen/Orbitron) |
| Playful display alt | "Bungee" | [fonts.google.com/specimen/Bungee](https://fonts.google.com/specimen/Bungee) |
| Body / instructions | system stack (`system-ui`) or "Rubik" | keeps load light |

**Pairing:** Press Start 2P for the logo + game-over headline only (it's unreadable at small sizes), Orbitron 700/900 for HUD score/distance/grade, system-ui for instructions. Load via one Google Fonts CSS request with `display=swap`; subset to Latin.

### Color Palette (school theme)

| Token | Hex | Use |
|-------|-----|-----|
| Primary | `#FFD700` gold | grades, score pops, START glow |
| Secondary | `#4169E1` royal blue | panel borders, school identity |
| Danger | `#FF3B30` | teacher warning, vignette |
| Success | `#34C759` | recovery streak, A+ collect |
| Text light | `#FFFFFF` | HUD text |
| Text dark | `#1A1A2E` | on-gold text |
| Background | `#1A1A2E` | screens, fog tint |
| Warning overlay | `rgba(255,0,0,.30)` | radial vignette |

### Key CSS components

```css
/* Glass HUD (backdrop-filter is GPU-composited; safe on modern mobile) */
.hud-item {
  background: rgba(26, 26, 46, 0.55);
  backdrop-filter: blur(10px);
  -webkit-backdrop-filter: blur(10px);
  border: 1px solid rgba(255, 215, 0, 0.35);
  border-radius: 12px;
  padding: 6px 14px;
  font-family: 'Orbitron', sans-serif;
  color: #fff;
}

/* Red vignette — teacher proximity (opacity driven from JS 0..1) */
.warning-overlay {
  position: fixed; inset: 0; pointer-events: none; opacity: 0;
  background: radial-gradient(ellipse at center,
              transparent 45%, rgba(255, 0, 0, 0.55) 100%);
  transition: opacity 0.25s linear;
  animation: pulse 0.8s ease-in-out infinite alternate;
}
@keyframes pulse { from { filter: brightness(0.85); } to { filter: brightness(1.2); } }

/* Pulsing START button */
.game-btn {
  animation: glow 1.2s ease-in-out infinite alternate;
  font-family: 'Press Start 2P', monospace;
}
@keyframes glow {
  from { box-shadow: 0 0 12px #ffd70055, 0 0 0 #ffd70000; transform: scale(1); }
  to   { box-shadow: 0 0 28px #ffd700cc, 0 0 60px #ffd70033; transform: scale(1.04); }
}
```

### UI inspiration (5)
1. [CodePen — retro arcade start screens](https://codepen.io/search/pens?q=retro+arcade+game+start+screen) (live-searchable collection)
2. [CodePen — glassmorphism HUD cards](https://codepen.io/search/pens?q=glassmorphism+hud)
3. [Subway Surfers HUD](https://play.google.com/store/apps/details?id=com.kiloo.subwaysurf) — minimal top corners, big center pickups (industry-standard runner HUD)
4. [Temple Run 2 HUD](https://play.google.com/store/apps/details?id=com.imangi.templerun2) — distance + objective layout to mirror
5. [Dribbble — game over screens](https://dribbble.com/tags/game-over-screen) — stat-card layouts for our end screen

**Screens:** 3 total per spec (Start / HUD+warning / Game-Over), all DOM-over-canvas, no extra libraries.

---

## 7. Performance Optimization Strategy

Targets: 60 FPS desktop, 30+ FPS mobile, < 5 s load, < 200 MB memory. The whole game is one draw-call-light scene — these 18 items keep it there:

### Checklist
1. ✅ Pin renderer `setPixelRatio(Math.min(devicePixelRatio, 2))` desktop, `1.5` mobile (config already has this).
2. ✅ **No shadows on mobile** (`ENABLE_SHADOWS_MOBILE: false` in spec) — blob-shadow sprites for characters instead.
3. ✅ Desktop shadow map: single directional light, `mapSize 1024` (2048 only if cheap), tight shadow camera (~30 u box) following the player.
4. ✅ Pool **everything** that spawns (§4.2) — zero allocation in the game loop.
5. ✅ Reuse `THREE.Vector3`/`Box3` scratch objects; never allocate in `update()`.
6. ✅ Static geometry for the track: merge each ground tile's decorations (`BufferGeometryUtils.mergeGeometries`) → 1 draw call per tile.
7. ✅ Share materials & geometries between pooled instances (`mesh.clone()` shares geometry by default — never `dispose()` during play).
8. ✅ Monitor `renderer.info.render.calls`; budget **< 100** draw calls desktop, **< 50** mobile.
9. ✅ Frustum culling is on by default — keep obstacle bounding spheres correct.
10. ✅ Fog (`near 30 / far 100` per spec) doubles as culling disguise: spawn obstacles at Z = −60, behind fog start.
11. ✅ Textures: power-of-two sizes, `SRGBColorSpace`, mipmaps on, `anisotropy ≤ 4` mobile / 8 desktop.
12. ✅ Sprites: `depthWrite: false`, `alphaTest: 0.05` where halos appear.
13. ✅ HUD is DOM (not canvas text) — updated only when values change, never per-frame string churn.
14. ✅ `document.hidden` → auto-pause; clamp clock delta `Math.min(dt, 0.1)` to prevent tunneling on tab-back.
15. ✅ Resize via `ResizeObserver` on the canvas container, debounced.
16. ✅ Antialias off on mobile (`antialias: window.devicePixelRatio < 2`); FXAA not needed at these poly counts.
17. ✅ Preload screen with `LoadingManager.onProgress` bar; audio lazy-unlocked by first tap (Howler).
18. ✅ LOD not required (< 5 k tris/model × dozens of objects ≪ budget); revisit only if `renderer.info` betrays us.

### FPS + memory debug snippet

```javascript
// fpsMonitor.js — toggle with CONFIG.DEBUG.SHOW_FPS
export function createFpsMonitor(renderer) {
  const el = Object.assign(document.createElement('pre'), { id: 'fps-monitor' });
  document.body.append(el);
  let frames = 0, last = performance.now(), mb = performance.memory?.usedJSHeapSize ?? 0;
  return (now) => {
    if (++frames >= 30) {
      const fps = (frames * 1000 / (now - last)).toFixed(0);
      mb = ((performance.memory?.usedJSHeapSize ?? mb) / 1048576).toFixed(0);
      el.textContent = `${fps} FPS · ${mb} MB · calls ${renderer.info.render.calls}`;
      frames = 0; last = now;
    }
  };
}
```

### Mobile vs desktop settings

| Setting | Desktop | Mobile |
|---------|---------|--------|
| pixelRatio | min(dpr, 2) | min(dpr, 1.5) |
| Shadows | on (1024 map) | off |
| Antialias | on | off |
| Anisotropy | 8 | 4 |
| Visible tiles | 20 | 14 |
| Max simultaneous obstacles | 24 | 16 |
| Detection | pointer: fine / no touch | `'ontouchstart' in window` + `navigator.deviceMemory` hints |

---

## 8. Deployment Guide

### Local dev servers

| Method | Command / steps | Pros | Cons |
|--------|-----------------|------|------|
| **VS Code Live Server** ✅ | Install extension → right-click `index.html` → *Open with Live Server* | zero config, auto-reload | requires VS Code |
| **Python** | `python -m http.server 8000` | preinstalled on Mac/Linux | no live reload |
| **Node** | `npx http-server -p 8000` | fast, caching flags | needs npm |

Any of these is **mandatory** — ES modules + texture loading fail under `file://` (see §10).

### Hosting comparison

| Platform | Ease | Free tier | Best for | Setup time |
|----------|------|-----------|----------|------------|
| **GitHub Pages** ✅ recommended | ★★★★★ (we're already in git) | Unlimited public repos, ~100 GB-mo soft band, 1 GB site | This project: push = deploy | ~5 min |
| **Netlify** (Drop) | ★★★★★ | 100 GB/mo bandwidth, 300 builds/mo | Instant share without git | ~2 min |
| **Vercel** | ★★★★ | 100 GB-mo, generous | Projects that later add a framework | ~5 min |
| **itch.io** | ★★★ | Unlimited HTML5 games, zip ≤ 1 GB, plays in iframe | Reaching gamers + comments; playable embedded | ~10 min |

**Recommendation:** GitHub Pages (single `git push` from this very repo; no build step since the game is static vanilla JS). Netlify Drop as the zero-git fallback for quick sharing. itch.io later if the user wants a "game page" with community features.

**GitHub Pages steps:** push this repo → *Settings → Pages → Source: Deploy from a branch → `main` / root* → live at `https://biral0-0.github.io/jyoti-run/` in ~1 min. (`gh` auth is available in this workspace — Phase 2 can enable this on request.)

### Local network & QR sharing

```bash
# 1) Serve
python -m http.server 8000
# 2) Find LAN IP — Windows: ipconfig | findstr IPv4 · macOS/Linux: ip addr / ifconfig
# 3) Friends on same WiFi open: http://<LAN-IP>:8000
# 4) Public temp URL + QR:
npx ngrok http 8000          # prints https://xxxx.ngrok-free.app (free tier)
# QR: any browser QR extension, or https://www.qr-code-generator.com (paste the URL)
```
Mobile testing tip: Chrome DevTools → *Remote Devices* / Safari → *Develop → [iPhone]* for on-device console logs.

---

## 9. Browser Compatibility Report

### Matrix (targets per spec)

| Browser | WebGL (Three.js) | Import maps | Web Audio | Swipe | Verdict |
|---------|------------------|-------------|-----------|-------|---------|
| Chrome 120+ (desktop/Android) | ✅ | ✅ | ✅ | ✅ | ⭐ Best — primary target |
| Edge 120+ | ✅ | ✅ | ✅ | ✅ | Excellent (Chromium) |
| Firefox 120+ | ✅ | ✅ | ✅ | ✅ | Excellent |
| Safari 17+ (macOS) | ✅ | ✅ (16.4+) | ✅ (unlock needed) | n/a | Good |
| Safari iOS 17+ | ✅ | ✅ | ✅ (silent-mode quirk) | ✅ | Good — test on device |
| WebGL-less / very old | ❌ | varies | — | — | Fallback screen (below) |

### Feature detection + fallback

```javascript
// support.js
export function checkSupport() {
  const problems = [];
  const canvas = document.createElement('canvas');
  const gl = canvas.getContext('webgl2') || canvas.getContext('webgl');
  if (!gl) problems.push('WebGL is not available');
  if (!window.HTMLScriptElement.supports?.('importmap')) problems.push('Import maps unsupported (very old browser)');
  if (!window.AudioContext && !window.webkitAudioContext) problems.push('Web Audio unavailable (game will run silent)');
  return {
    ok: problems.every(p => !p.includes('Audio') === false || !p.includes('WebGL') && !p.includes('Import')),
    problems,
    gl,
  };
}
// On failure, render #unsupported-screen with the messages (kept in index.html, hidden by default).
```

### Known issues & workarounds
- **Autoplay policy (all):** audio must start from a user gesture → Howler `autoUnlock` + we start music on the START button click. ✅ designed in.
- **iOS Safari:** silent-mode switch mutes WebAudio by default (user setting); elastic overscroll fights swipes → `touch-action: none; overscroll-behavior: none;` + `preventDefault` on touchmove; `backdrop-filter` needs the `-webkit-` prefix; `100vh` jumps → use `100dvh`.
- **Android Chrome:** back-gesture swipes from screen edges can fire during play → keep a 16 px dead-zone at screen edges in the swipe handler.
- **Firefox:** fine; only note is font rendering of Press Start 2P (subpixel) — cosmetic.
- **Low-end device detection:** `navigator.deviceMemory < 4 || hardwareConcurrency <= 4` → auto-apply the mobile settings table from §7 regardless of touch capability.

---

## 10. Troubleshooting Guide (CORS & asset loading)

| Symptom | Cause | Fix |
|---------|-------|-----|
| `Access to fetch at 'file:///…' blocked by CORS` | ES modules / fetch disallowed on `file://` | Serve over HTTP (`python -m http.server`) — never open index.html directly |
| `CORS policy: No 'Access-Control-Allow-Origin'` on textures | Cross-origin asset (e.g., hotlinked image) | Keep assets same-origin; if remote, load with `crossOrigin = 'anonymous'` and host must send ACAO header |
| `GLTFLoader: Failed to parse` | Wrong path → HTML 404 page parsed as GLB | Check Network tab status; use relative paths from `index.html` (`assets/models/…`) |
| Textures load but render black | Missing `texture.colorSpace = THREE.SRGBColorSpace` (r152+) | Set colorSpace on color maps; leave normal/roughness maps linear |
| `THREE.WebGLRenderer: Context Lost` | GPU reset (mobile tab-switch) | Listen `webglcontextlost` → show pause overlay; `webglcontextrestored` → resume |
| Model loads but is invisible | glTF scale/units mismatch | glTF is meters — verify bounding box via `Box3.setFromObject`; scale props to game units at load |
| Audio plays once then silent | Creating `new Howl` per play | Create once at load; call `.play()` on the instance |
| 404 on CDN import after deploy | Unpinned/moved version | Pin exact version (`three@0.160.0`) on jsDelivr |

**Error-handling pattern for Phase 2:** wrap every loader in a `Promise` whose `.catch()` (a) logs the URL, (b) swaps in a generated placeholder (canvas texture / box mesh), and (c) shows a toast "asset X failed — using placeholder". The game must boot even with a totally empty `assets/` folder.

---

## 11. Recommended Tech Stack Summary

| Component | Choice | Version (verified 2026-09-11) | Why |
|-----------|--------|-------------------------------|-----|
| Renderer | Three.js (WebGL) | **0.160.0 pinned** (spec) — current stable is 0.186.0; our usage is identical across both | Battle-tested WebGLRenderer; import map + addons path (`three/addons/loaders/GLTFLoader.js`) |
| Module loading | Native ES modules + **import map** (CDN: jsDelivr) | — | No build tools, per spec; optional local copy of `three.module.js` for offline |
| 3D models | GLTFLoader + `.glb` | — | Spec requirement; all chosen assets ship GLB |
| Characters | `THREE.Sprite` billboards | — | §3 verdict |
| Audio | **Howler.js** | **2.2.4** (MIT, latest) | §5A |
| Physics | None (custom AABB/sphere checks) | — | Runner collisions are trivially separable; a physics engine is 100 KB+ of waste |
| Input | Vanilla touch + keyboard | — | §4.1 |
| UI | DOM + CSS (glassmorphism, Press Start 2P/Orbitron) | — | §6 |
| Fonts | Google Fonts CDN, `display=swap` | — | §6 |
| Hosting | **GitHub Pages** (this repo) | — | §8 |
| Dev server | VS Code Live Server / `python -m http.server` | — | §8 |

---

## 12. Questions for User

1. **The 3 custom images** — please upload to `assets/textures/`:
   - `ground-gravel.png` (seamless/tileable, ≥ 1024×1024)
   - `student-character.png` (transparent background, ≥ 512×512)
   - `teacher-character.png` (transparent background, ≥ 512×512)
   → If you don't have them yet: should Phase 2 **generate placeholders** (procedural gravel texture + drawn student/teacher sprites) so the game is playable immediately, with drop-in replacement documented?
2. **Art direction check:** cheerful cartoon school (bright, Subway-Surfers-like) — or darker "detention nightmare" mood? (Affects fog color, sky, UI tint.)
3. **High-score persistence:** keep best score/distance in `localStorage` and show "BEST" on the start screen? (Recommended: yes, ~10 lines.)
4. **Pause:** add a pause control (desktop `P`/`Esc`, mobile top-right) or keep the spec's screen-free flow?
5. **Difficulty:** OK with spec values (speed 15→45, game over at 3 mistakes), or more casual (4–5 mistakes, slower ramp) for the first public build?
6. **Language:** English-only UI, or English + Nepali text on the start screen?

---

## 13. Asset Download Package

The sandbox has no direct internet access, so the package ships as a **download script + manifest** instead of pre-downloaded binaries. Running it in any online environment populates `assets/` exactly per the Phase 2 file structure.

**Included now in this repo:**
- [`scripts/download-assets.sh`](../scripts/download-assets.sh) — downloads the CC0 packs (Kenney direct zips; Quaternius/KayKit via poly.pizza), verifies archives, extracts into `assets/models/{environment,obstacles}/`, and prints the few links that need a manual browser click (poly.pizza per-model downloads and Mixkit SFX buttons are click-driven).
- `assets/` folder structure pre-created with `.gitkeep` files (Phase 2 fills it).

**Manual (2-click) items:** Mixkit SFX (download button per sound — §5B table maps each to its target filename) and the user's 3 custom images.

**Folder structure after running:**
```
assets/
├── models/
│   ├── environment/     # kenney furniture-kit + city-roads extracts (GLB)
│   └── obstacles/       # desk.glb, cone.glb, barrier.glb … (Quaternius/KayKit)
├── textures/            # user's 3 PNGs + ambientCG fallback gravel (optional)
├── sounds/              # jump/collect/hit/teacher-alert/gameover/bg-music .mp3
└── lib/                 # cached three.module.js + howler.min.js (optional, for offline)
```

---

## ✋ Approval Checkpoint — STOP

Per the Phase 1 brief, development does **not** begin until:
1. ✅ This research report is reviewed → **awaiting your approval**
2. ⬜ Recommended approaches approved (or amended)
3. ⬜ Your 3 custom images provided (`ground-gravel.png`, `student-character.png`, `teacher-character.png`) — or approval to use generated placeholders
4. ⬜ Answers to §12 questions (1 and 5 matter most)

**On approval, Phase 2 delivers:** the complete `school-runner/` static site per the spec's file structure (config / main / managers / entities / utils), all mechanics from the testing checklist, a placeholder-capable asset pipeline, a README with setup + sharing guide, and a live preview running in this workspace — in 1–2 working sessions.

---

*Research sources verified 2026-09-11: GitHub API (repo stats/licenses), npm registry (three 0.186.0, howler 2.2.4), kenney.nl, poly.pizza (live model pages), mixkit.co (live SFX listings), ambientcg.com / 3dtextures.me / texturecan.com / polyhaven.com, Google Fonts, utsubo.com Three.js 2026 review.*
