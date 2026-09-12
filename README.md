# 🏫 School Runner: Teacher Chase

A 3D endless-runner web game built with **Three.js** — you're a student sprinting
down the schoolyard, dodging obstacles and grabbing grade papers, while the
**teacher only appears when you make mistakes**. Inspired by Subway Surfers +
Temple Run.

> **Zero-asset boot:** the game ships fully playable with *no asset files* —
> all art is generated procedurally at load (canvas textures + low-poly
> primitives) and all audio is synthesized with the Web Audio API. Drop your
> own images and sounds into `assets/` to override anything (see below).

## 🎮 How to Play

- **Dodge obstacles** — jump over desks, slide under barriers, switch lanes
  around lockers
- **Collect grade papers** (D → C → B → A+) for points; better grades unlock
  at longer distances (B at 500 m, A+ at 1500 m)
- **Avoid the teacher** — she's *invisible* until your first mistake, then
  she's right behind you (red screen edges = she's close!)
- **Recover** by running **100 m clean** — hit three obstacles (or let her
  catch you) and it's game over

| Obstacle | Examples | Counter |
|----------|----------|---------|
| Low | desk, crate, bench | **Jump** (↑ / W / Space, swipe up) |
| High | barrier, gate | **Slide** (↓ / S, swipe down) |
| Blocker | locker, roadblock | **Change lane** (← → / A D, swipe left/right) |

## 🎯 Controls

**Desktop**

| Key | Action |
|-----|--------|
| `←` / `→` or `A` / `D` | Switch lanes |
| `↑` or `W` or `Space` | Jump |
| `↓` or `S` | Slide |
| `P` or `Esc` | Pause / resume |
| `M` | Mute / unmute |

**Mobile** — swipe in any direction (24 px threshold). No on-screen buttons.
The game auto-pauses when you switch tabs.

## ⚙️ Setup

The game is pure static files (vanilla ES modules, no build step) but **must
be served over HTTP** — ES modules + texture loading don't work from
`file://`. Any static server works:

**Option A: VS Code Live Server** *(recommended)*
1. Install the “Live Server” extension
2. Right-click `index.html` → *Open with Live Server* → `http://localhost:5500`

**Option B: Python**
```bash
cd jyoti-run
python3 -m http.server 8000
# open http://localhost:8000
```

**Option C: Node**
```bash
npx http-server -p 8000
# or: npx serve
```

> Three.js r160 and Howler.js 2.2.4 load from the jsDelivr CDN via an import
> map, so keep internet access on first load (or cache them into `assets/lib/`
> and edit the import map in `index.html` for fully-offline use).

## 🎨 Replacing the Placeholder Art

Every image is an **optional drop-in override**. Put it here and reload — no
code changes needed:

```
assets/textures/
├── ground-gravel.png            ← seamless ground texture (1024×1024+, tiles 12×10 u)
├── student-character.png        ← student, transparent bg — SHIPPED (3:5)
├── student-character-front.png  ← student facing the camera — SHIPPED (3:5)
├── teacher-character.png        ← teacher, transparent bg — SHIPPED (2:3)
└── teacher-character-front.png  ← teacher facing the camera — SHIPPED (2:3)
```

- Character PNGs render as **billboard sprites** with the pivot at the feet.
  Anything with a transparent background works; the runner is seen from behind,
  so a back view is the natural default frame.
- The shipped sprites come from the full-size renders in `assets/source-art/`
  (kept in the repo for re-crops) via
  `.harness/art/prepare-sprites.sh`, which alpha-trims the figure, scales it to
  fill the plane height and anchors the feet centre-bottom. The result is an
  exact-ratio, transparent-background texture — nothing is stretched.
- On boot the game silently probes for these files; if one is missing it uses
  the procedural version instead. (The probes show as 404s in the DevTools
  console/network tab when the files are absent — that's expected and
  harmless. `ground-gravel.png` is the one optional file with no committed
  default, so that single 404 is normal.)

**Faking 3D turns.** A `THREE.Sprite` always faces the camera, and three.js
rebuilds its quad in view space every frame — so **object rotation on a Sprite
does nothing** (only scale is read from the object matrix, and screen-space
roll comes from `SpriteMaterial.rotation`). The turn is therefore faked the way
sprite games have always done it, all config-driven under
`CONFIG.PLAYER.VIEW_*` / `CONFIG.TEACHER.VIEW_*`:

| Effect | How |
|---|---|
| the body pivots as it changes lanes | `scale.x = W · cos(turn)`, turn = `VIEW_TURN` × lane offset |
| it leans into the turn | `material.rotation = -turn · VIEW_LEAN` |
| it faces the camera when it truly does | the `*-front.png` render, used for the player's stumble and the teacher's catch pose |
| it wobbles when it trips | the same material roll (this was silently a no-op before) |

With no `*-front.png` present the sprite simply stays a flat card that leans —
the placeholder art is unaffected. Collision boxes never change.

**Shipped defaults.** The texture slots above are optional and stay on the
procedural placeholders until you add files; `assets/sounds/` already ships a
complete synthesized mp3 set (below). `.gitignore` ignores
`assets/textures/*.png` and `assets/sounds/*.mp3` by default and re-includes
the shipped files with `!`-exceptions — add a matching `!` line when you want a
new drop-in file committed.

**Aspect handling.** The sprite planes are 1.5 × 2.5 (student) and 2 × 3
(teacher) world units — that is what the collision math assumes. Art whose ratio
differs is **letterboxed, never stretched**: `CONFIG.PLAYER.FIT_ASPECT` / `CONFIG.TEACHER.FIT_ASPECT` keep the
plane height authoritative and derive the width from the image's own aspect
(`MAX_SPRITE_WIDTH` clamps extremes). Set them to `false` in `js/config.js` for
the original stretch-to-plane behaviour. Collision boxes are unaffected either
way — they live in `CONFIG.PLAYER.COLLISION_RADIUS` / `CONFIG.OBSTACLES.TYPES`.

### Adding real sounds (optional)

```
assets/sounds/
├── jump.mp3  collect.mp3  hit.mp3
├── teacher-alert.mp3  gameover.mp3
└── bg-music.mp3        ← loops
```

The repository ships this exact set (synthesized for the project), so the
Howler path is active out of the box; overwrite any file with your own
recording — the file names are the contract.

If `bg-music.mp3` exists, the game lazy-loads **Howler.js 2.2.4** (pinned CDN
URL) and plays whatever files are present; any missing file falls back to the
built-in Web-Audio synthesis. No game code needs to change.

### Scenery

`assets/scenery/` holds the supplied school photos (corridor, gate arch, gate
avenue) for future use — a start-screen backdrop, a menu scene, decals, etc.
Nothing loads them yet, so they cost nothing at runtime.

### Adding 3D models (optional, advanced)

Obstacles are intentionally built from primitives in code (1 draw call each,
zero downloads). If you want GLB models instead, `scripts/download-assets.sh`
fetches the CC0 packs researched in Phase 1 (Kenney Furniture Kit, Quaternius
traffic props, KayKit road bits) into `assets/models/`. To use them you'd add
`GLTFLoader` (from `three/addons/loaders/GLTFLoader.js`) in
`js/managers/ObstacleManager.js` and replace `buildVariantGeometry()` — the
pooling/collision logic stays the same (each variant's collision box is in
`CONFIG.OBSTACLES.TYPES`).

## 🔧 Customization

Every tunable number lives in **`js/config.js`** — speed ramp, lane width,
jump height, teacher chase distances, obstacle types & spawn rates, grade
tiers & points, colors, audio volumes, mobile performance settings, and debug
flags:

```js
DEBUG: {
    SHOW_FPS: false,             // live FPS/draw-call/tri counter
    SHOW_COLLISION_BOXES: false,
    GOD_MODE: false,             // no collisions (testing)
    SKIP_START_SCREEN: false,
}
```

URL params `?desktop=1` / `?mobile=1` force desktop/mobile tuning (useful for
testing). `window.__game` exposes the live game instance in the console.

### Difficulty at a glance

| Distance | Papers | Speed | Obstacles |
|----------|--------|-------|-----------|
| 0–500 m | D + C | 15 → rising | sparse, single obstacles |
| 500–1500 m | C + B | mid | denser, doubles begin |
| 1500 m+ | B + A+ | → 45 (cap) | 65% spawn chance |

Speed ramps 15 → 45 units/s at +0.5/s; obstacle spawn chance eases from
25% → 65% between 500–1500 m (smoothstep — no difficulty cliffs).

## 🌐 Deployment

**GitHub Pages**
1. Push this repo to GitHub
2. *Settings → Pages → Source: Deploy from branch → `main` / root*
3. Live at `https://<user>.github.io/jyoti-run/`

**Netlify** — drag the repo folder onto [netlify.com/drop](https://app.netlify.com/drop)
for an instant URL. **itch.io** also works (zip the folder, upload as HTML5 game).

## 🖥️ Browser Compatibility

| Browser | Version | Notes |
|---------|---------|-------|
| Chrome | 120+ | ⭐ best (primary target) |
| Edge | 120+ | excellent |
| Firefox | 120+ | excellent |
| Safari (macOS/iOS) | 17+ | good; audio unlocks on the START tap |
| Mobile Chrome/Safari | latest | good; shadows auto-disabled, pixel ratio capped |

Browsers without WebGL or import-map support get a friendly fallback screen.

## 🐛 Troubleshooting

- **Blank page / CORS error** — you opened `index.html` via `file://`. Serve
  it over HTTP (see Setup).
- **Textures black or missing** — check the Network tab for 404s and keep
  assets same-origin.
- **No sound** — click START first (browser autoplay policy); check the 🔊
  button; iOS silent-switch mutes Web Audio.
- **Low FPS** — set `LIGHTING.SHADOWS.enabled = false` or
  `GROUND.VISIBLE_TILES = 14` in `js/config.js`.

## 📦 Project Structure

```
├── index.html                  # entry point + import map (three@0.160.0)
├── css/style.css               # UI (glassmorphism HUD, screens, vignette)
├── js/
│   ├── config.js               # EVERY tunable value
│   ├── main.js                 # boot, game loop, collisions, camera
│   ├── managers/
│   │   ├── GroundManager.js    # instanced tile ring + decor + clouds
│   │   ├── ObstacleManager.js  # pooled props, difficulty-driven spawning
│   │   ├── CollectibleManager.js # grade papers, patterns, A+ glow
│   │   ├── AudioManager.js     # Web-Audio synth + Howler override
│   │   └── UIManager.js        # screens, HUD, popups, vignette
│   ├── entities/
│   │   ├── Player.js           # sprite controller + dust puffs
│   │   └── Teacher.js          # chase state machine + fairness guards
│   └── utils/
│       ├── InputHandler.js     # keyboard + swipe
│       ├── ObjectPool.js       # generic pooling (report §4.2)
│       ├── GameState.js        # state machine, scoring, best scores
│       ├── Difficulty.js       # speed/spawn/tier curves (report §4.3)
│       ├── placeholderArt.js   # ALL procedural art (swappable)
│       └── AssetLoader.js      # optional-file probes + fallbacks
├── assets/                     # shipped sprites/audio + drop-in overrides
│   ├── source-art/             # full-size renders the sprites were cut from
│   └── scenery/                # school photos, stored for later
├── .harness/                   # offline verification rig (dev only, see .harness/README.md)
├── scripts/download-assets.sh  # optional CC0 asset fetcher (Phase 1)
└── research/RESEARCH_REPORT.md # Phase 1 research
```

## 📜 Credits

**Built with**
- [Three.js r160](https://threejs.org) (MIT) — rendering, sprites, instancing
- [Howler.js 2.2.4](https://howlerjs.com) (MIT) — optional real-file audio
- Vanilla ES modules — no build tools, no frameworks

**Procedural placeholder art & synth audio** generated in-code at load. The
shipped `assets/sounds/*.mp3` set was synthesized for this project with a
pure-JS MP3 encoder (no third-party samples), under the same MIT license.

**Optional real assets (CC0 / free licenses)** researched in Phase 1:
- 3D props: [Kenney Furniture Kit](https://kenney.nl/assets/furniture-kit),
  [Quaternius traffic props on poly.pizza](https://poly.pizza/u/Quaternius),
  [KayKit Road Bits](https://poly.pizza/m/5BPCPOycxC) — all CC0
- Textures: [ambientCG gravel/concrete](https://ambientcg.com/view?id=Gravel001) — CC0
- Sounds: [Mixkit game SFX](https://mixkit.co/free-sound-effects/game/)
  (Mixkit License — free, no attribution),
  [Kenney UI Audio / Music Jingles](https://kenney.nl/assets/ui-audio) — CC0

**License:** MIT — feel free to modify and share!

---

**Enjoy running from the teacher! 🏃‍♂️👨‍🏫**
