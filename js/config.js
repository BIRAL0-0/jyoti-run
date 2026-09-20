/**
 * School Runner: Teacher Chase — Game Configuration
 * -------------------------------------------------
 * ALL tuneable game values live here. Every number used by the game is
 * config-driven; nothing is hard-coded in the managers/entities.
 *
 * Placeholders: the game boots with ZERO asset files. Procedural art
 * (canvas textures / primitive geometry / Web-Audio synth) is generated at
 * load. Drop real files into assets/textures/ and assets/sounds/ to override
 * (see README.md "Replacing the placeholder art").
 */

export const CONFIG = {
    // ========== GROUND & MOVEMENT ==========
    GROUND: {
        TILE_LENGTH: 20,              // Length of each ground tile
        TILE_WIDTH: 12,               // Width (must cover 3 lanes)
        VISIBLE_TILES: 20,            // Number of tiles in the recycling ring
        INITIAL_SPEED: 15,            // Starting movement speed (units/s)
        MAX_SPEED: 45,                // Maximum speed cap
        SPEED_INCREMENT: 0.5,         // Speed increase per second
        // Procedural fallback gravel texture (used when the user's
        // ground-gravel.png is absent)
        TEXTURE_SIZE: 512,
        TEXTURE_REPEAT_Y: 2,          // texture tiles per tile along Z
        CURB_WIDTH: 0.6,              // blue curb strips at the track edge
        CURB_HEIGHT: 0.3,
        GRASS_COLOR: 0x7ec850,        // schoolyard lawn beyond the curbs
        // Width of the lawn apron. It only has to reach past the buildings —
        // beyond that the fog takes over (see LIGHTING.FOG.far).
        APRON_WIDTH: 130,
    },

    // ========== LANE SYSTEM ==========
    LANES: {
        COUNT: 3,                     // Always 3 lanes
        WIDTH: 4,                     // Distance between lane centers
        POSITIONS: [-4, 0, 4],        // X positions: left, center, right
        SWITCH_SPEED: 12,             // Lane switch lerp rate (1/s)
        SWITCH_DURATION: 0.2,         // Seconds to complete lane switch
    },

    // ========== PLAYER CHARACTER ==========
    PLAYER: {
        SPRITE_HEIGHT: 3.0,           // Sprite scale height
        SPRITE_WIDTH: 1.8,            // Sprite scale width (placeholder/fallback)
        // User PNGs rarely match 3:5 exactly. When FIT_ASPECT is true and a
        // student-character.png is present, SPRITE_HEIGHT stays authoritative
        // and the width is derived from the image's own aspect ratio, so the
        // art is never stretched. MAX_SPRITE_WIDTH clamps absurdly wide art.
        FIT_ASPECT: true,
        MAX_SPRITE_WIDTH: 3.0,
        // Optional FRONT render (assets/textures/student-character-front.png).
        // A THREE.Sprite always faces the camera, so a "3D turn" is faked the
        // way sprite-based games do it: the billboard is foreshortened on X
        // (scale.x = W·cos(turn)) and rolled in screen space
        // (SpriteMaterial.rotation), and the optional front render takes over
        // whenever the body genuinely faces the camera (e.g. a stumble).
        // Note: sprite.rotation.* has NO effect in three.js for Sprite objects
        // — the roll must go through the material.
        FRONT_URL: 'assets/textures/student-character-front.png',
        VIEW_TURN: 0.16,              // implied turn (rad) per world unit of lane offset
        VIEW_LEAN: 0.34,              // screen-space roll per radian of implied turn
        VIEW_SWAY: 1,                 // turn smoothing rate (0 = instant, higher = snappier)
        VIEW_MIN_SCALE: 0.55,         // clamp for the foreshortening
        VIEW_STUMBLE_FRONT: true,     // show the front render while stumbling
        JUMP_HEIGHT: 3.5,             // How high player jumps
        JUMP_DURATION: 0.6,           // Seconds in air
        SLIDE_DURATION: 0.8,          // Slide animation time
        SLIDE_HEIGHT: 0.8,            // Collision height when sliding
        STUMBLE_DURATION: 1.5,        // Slowdown after hit
        STUMBLE_SPEED_MULT: 0.3,      // Speed multiplier when stumbling (30%)
        RUN_BOB_AMOUNT: 0.12,         // Up/down bobbing amount
        RUN_BOB_SPEED: 9,             // Bobbing frequency
        COLLISION_RADIUS: 0.8,        // Collision detection size (x/z width)
        RUN_FRAME_RATE: 7,            // placeholder run-cycle frames per second
        HIT_TINT: 0xff5555,           // red flash colour when stumbling
        // Dust puff particles (pooled sprites)
        DUST_POOL_SIZE: 12,
        DUST_LAND_COUNT: 5,           // puffs on landing
        DUST_HIT_COUNT: 6,            // puffs on stumbling
        DUST_LIFETIME: 0.55,
    },

    // ========== TEACHER CHASE MECHANIC ==========
    // State machine: HIDDEN -> CHASING -> FADING_OUT -> HIDDEN
    //                            \-> CAUGHT (2nd mistake or sustained contact)
    // Fairness guards from the research report §4.4.
    TEACHER: {
        APPEAR_DISTANCE: 12,          // Normalisation distance for warning intensity
        CATCH_DISTANCE: 1.5,          // "Caught" contact distance
        CHASE_SPEED_MULTIPLIER: 1.3,  // Teacher runs 30% faster than the player
        RECOVERY_DISTANCE: 150,       // Clean metres to run to hide the teacher
        MINOR_BLUNDER_THRESHOLD: 1,   // Mistakes needed to trigger appearance
        MAJOR_BLUNDER_THRESHOLD: 2,   // Instant game over threshold
        SPRITE_HEIGHT: 3,             // Teacher sprite size
        SPRITE_WIDTH: 2,              // Teacher sprite width (placeholder/fallback)
        // Same aspect handling as the player (see CONFIG.PLAYER.FIT_ASPECT).
        FIT_ASPECT: true,
        MAX_SPRITE_WIDTH: 3,
        // Same view handling as the player (see CONFIG.PLAYER.FRONT_URL).
        FRONT_URL: 'assets/textures/teacher-character-front.png',
        VIEW_TURN: 0.14,              // implied turn (rad) per world unit of lane offset
        VIEW_LEAN: 0.28,
        VIEW_SWAY: 1,
        VIEW_MIN_SCALE: 0.6,
        VIEW_CATCH_FRONT: true,       // face the camera for the catch pose
        FADE_DURATION: 0.5,           // Fade in/out animation time

        // --- Refined chase behaviour (research report §4.4) ---
        // The teacher spawns between the camera and the player (positive Z is
        // "behind" the runner). She eases in to a hover distance, then eases
        // back as the single tolerated mistake decays. The 2nd mistake is the
        // catch (MAJOR_BLUNDER_THRESHOLD = 2), so the surge path below is
        // dormant but left live should the threshold ever return to 3.
        SPAWN_MARGIN: 2.6,            // how far in front of the camera she fades in
        MENACE_DISTANCE: 5.5,         // hover distance after 1st mistake
        SURGE_DISTANCE: 3.2,          // hover distance after 2nd mistake
        SURGE_BOOST: 1.0,             // extra approach speed multiplier on surge (0.6 s)
        SURGE_DURATION: 0.6,
        AGGRO_CLEAN_METERS: 120,      // clean metres over which chase multiplier eases 1.3 -> 1.0
        RELAX_RATE: 1.5,              // u/s at which she drifts back out after mistake decay
        MISTAKE_DECAY_METERS: 150,    // -1 mistake per 150 m of clean running (== RECOVERY_DISTANCE)
        CATCH_SUSTAIN: 0.4,           // <= CATCH_DISTANCE sustained this long (s) = caught
        FADE_GRACE: 0.5,              // no catch checks during fade-in
        LUNGE_GRACE_DISTANCE: 1.6,    // holds here if contact while mid-jump/slide...
        LUNGE_GRACE_TIME: 1.0,        // ...for at most this long
        CATCH_ANIM_DISTANCE: 0.55,    // final distance for the grab pose
        CATCH_ANIM_SPEED: 10,         // u/s closing speed of the catch animation
        WEAVE_LERP: 3,                // how lazily she weaves toward the player's lane
        RUN_FRAME_RATE: 8,            // placeholder run-cycle frames per second
        WARNING_MAX: 0.55,            // vignette scale while CHASING
        SURGE_WARNING_BONUS: 0.25,    // extra vignette right after a surge
    },

    // ========== OBSTACLES ==========
    OBSTACLES: {
        SPAWN_DISTANCE_AHEAD: 60,     // How far ahead to spawn
        MIN_GAP_BETWEEN: 12,          // Minimum space (u) between rows
        INITIAL_SPAWN_CHANCE: 0.25,   // 25% spawn chance at start
        MAX_SPAWN_CHANCE: 0.65,       // Increases to 65% at max difficulty
        DESPAWN_DISTANCE: 15,         // Recycle when this far behind the player
        START_GRACE_DISTANCE: 25,     // no obstacles for the first N metres
        DOUBLE_CHANCE_START: 0.25,    // chance a row holds 2 obstacles (early)
        DOUBLE_CHANCE_MAX: 0.5,       // chance a row holds 2 obstacles (late)
        INTRO_ROWS: 3,                // first rows are always single LOW (tutorial)
        // A slide locks the lane for SLIDE_DURATION; never place a BLOCKER in
        // the same lane this close behind a HIGH obstacle (fairness guard).
        HIGH_LOCK_SAFE_DISTANCE: 36,

        // Relative type weights, early -> late difficulty
        WEIGHTS: {
            LOW:      [0.45, 0.35],
            HIGH:     [0.25, 0.35],
            BLOCKER:  [0.30, 0.30],
        },

        TYPES: {
            LOW: {                     // Must jump over
                height: 1.2,
                requiresJump: true,
                models: ['desk', 'crate', 'bench'],
                variants: [
                    { id: 'desk',  halfW: 0.85, halfD: 0.55, yMin: 0,    yMax: 1.725 },
                    { id: 'crate', halfW: 0.72, halfD: 0.55, yMin: 0,    yMax: 1.725 },
                    { id: 'bench', halfW: 0.85, halfD: 0.45, yMin: 0,    yMax: 1.5  },
                ],
            },
            HIGH: {                    // Must slide under
                height: 2.8,
                requiresSlide: true,
                clearance: 2.0,        // free space under the crossbar
                top: 3.8,              // top of the crossbar (above jump apex 3.5)
                models: ['barrier', 'gate'],
                variants: [
                    { id: 'barrier', halfW: 1.85, halfD: 0.25, yMin: 2.0, yMax: 3.8 },
                    { id: 'gate',    halfW: 1.85, halfD: 0.25, yMin: 2.0, yMax: 3.9 },
                ],
            },
            BLOCKER: {                 // Must switch lanes (full height)
                height: 2,
                requiresLaneSwitch: true,
                top: 4.2,              // taller than jump apex => unjumpable
                models: ['locker', 'roadblock'],
                variants: [
                    { id: 'locker',    halfW: 0.8,  halfD: 0.45, yMin: 0,   yMax: 4.2 },
                    { id: 'roadblock', halfW: 1.25, halfD: 0.3,  yMin: 0.3, yMax: 4.15 },
                ],
            },
        },

        // Prop palette (procedural primitive props share these)
        COLORS: {
            wood:       0xc68642,
            woodDark:   0x8b5a2b,
            crate:      0xd9a85f,
            metal:      0x9aa5b1,
            blue:       0x4169e1,
            blueDark:   0x2b3a67,
            gold:       0xffd700,
            white:      0xf4f6f8,
            green:      0x34c759,
            orange:     0xff8c42,
            red:        0xd9534f,
            lockerBlue: 0x3d5fbf,
        },

        // Per-type vertical scale applied to the merged geometry AND its
        // collision yMin/yMax (the latter are baked into TYPES[].variants
        // above, so keep these in sync). Owner review: desks/crates/benches
        // were too small next to the ×1.2 character, so LOW furniture is 1.5×.
        HEIGHT_SCALE: {
            LOW: 1.5,
            HIGH: 1,
            BLOCKER: 1,
        },
    },

    // ========== COLLECTIBLES (GRADE PAPERS) ==========
    GRADES: {
        SPAWN_CHANCE: 0.5,            // 50% chance to spawn a pattern per window
        SPAWN_DISTANCE_AHEAD: 50,
        SPAWN_WINDOW_MIN: 18,         // metres between spawn windows
        SPAWN_WINDOW_VAR: 14,         // + random metres
        START_GRACE_DISTANCE: 25,     // no papers for the first N metres
        FLOAT_HEIGHT: 1.5,            // Y position
        FLOAT_BOB_AMOUNT: 0.3,        // Up/down floating animation
        FLOAT_BOB_SPEED: 2.4,         // bob frequency (rad/s)
        FLOAT_ROTATION_SPEED: 2,      // Rotation speed (rad/s, full spin)
        COLLECTION_RADIUS: 1.2,       // Pickup distance (x/z)
        COLLECTION_HALF_HEIGHT: 0.55, // vertical pickup tolerance
        PAPER_WIDTH: 1.05,
        PAPER_HEIGHT: 1.35,
        POOL_SIZE: 14,                // max concurrent papers (mobile: fewer)
        COMBO_WINDOW: 1.5,            // seconds between collects to keep combo
        A_PLUS_SHAKE: 0,              // camera-shake intensity on an A+ pickup (0 = off)

        PATTERNS: ['line', 'across', 'arc', 'zigzag'], // Spawn patterns
        PATTERN_STEP: 2.6,            // metres between papers inside a pattern
        PATTERN_LENGTHS: { line: 5, across: 2, arc: 7, zigzag: 7 },

        // Difficulty tiers
        TIERS: [
            {
                minDistance: 0,
                grade: 'D',
                color: 0x8B4513,      // Brown
                cssColor: '#a05a2c',
                points: 10,
                spawnWeight: 0.4      // relative spawn weight once unlocked
            },
            {
                minDistance: 0,
                grade: 'C',
                color: 0xFFD700,      // Gold
                cssColor: '#FFD700',
                points: 15,
                spawnWeight: 0.6
            },
            {
                minDistance: 500,
                grade: 'B',
                color: 0x4169E1,      // Royal Blue
                cssColor: '#4169E1',
                points: 25,
                spawnWeight: 1.0
            },
            {
                minDistance: 1500,
                grade: 'A+',
                color: 0xFF1493,      // Hot Pink
                cssColor: '#FF1493',
                points: 50,
                spawnWeight: 1.0
            }
        ],
        // Weight multiplier for tiers that have been superseded by a newer one
        SUPERSEDED_WEIGHT: 0.35,
    },

    // ========== ROADSIDE DECOR ==========
    // Plants sit OUTSIDE the fence, in the verge between railing and
    // buildings (see CONFIG.CAMPUS for the full cross-section). Trees and
    // bushes only — rocks and traffic cones were pure road clutter that
    // clashed with the semi-realistic buildings.
    DECOR: {
        // Organised school landscaping — a regular lattice mirrored on both
        // sides (no random scatter): rounded ornamental trees on the outer
        // line, bush planters on the inner line. Both spacings divide PERIOD
        // so the lattice can recycle with a single snap.
        TREE_X: 12.2,
        TREE_SPACING: 12,
        PLANTER_X: 9.9,
        PLANTER_SPACING: 8,
        PERIOD: 24,                 // lcm(TREE_SPACING, PLANTER_SPACING)
        SCALE_VAR: 0.15,            // tiny size variance keeps the rows tidy
        COLORS: {
            trunk: 0x7a4a24,
            leaf1: 0x3fa34d,
            leaf2: 0x2e7d32,
            bush: 0x46b04a,
            planter: 0xcfc9bb,
            planterD: 0xb0aa9c,
        },
    },

    // ========== SCHOOL CAMPUS ==========
    // Cross-section, centre of the track outwards (item 2 of the owner's
    // review). Everything here is procedural and periodic, so it recycles
    // forever with the same group-shift trick as the ground tiles:
    //
    //   Building | Plants | Fence | Sidewalk | ROAD | Sidewalk | Fence | Plants | Building
    //
    // Each band is one or two InstancedMeshes, so the whole campus costs a
    // handful of draw calls no matter how far it runs.
    CAMPUS: {
        ENABLED: true,

        // Cross-section, centre out:
        //   ROAD | BORDER(+RAILING) | HEDGE | planters/trees | VERANDA | BUILDINGS

        // Raised concrete border hugging the path edge; the dark metal
        // railing stands on top of it.
        BORDER: {
            ENABLED: true,
            INNER_X: 6.0,             // road edge (GROUND.TILE_WIDTH / 2)
            WIDTH: 1.1,
            HEIGHT: 0.5,
            COLOR: 0xd8d2c4,
            LIP_COLOR: 0xb8b2a4,
        },

        // Dark metal railing on the border.
        RAILING: {
            ENABLED: true,
            X: 6.55,
            PANEL_SPACING: 4,
            POST_HEIGHT: 1.15,
            POST_WIDTH: 0.09,
            RAIL_HEIGHT: 0.08,
            RAIL_Y: [0.62, 1.02],
            COLOR: 0x2e3440,
            POST_COLOR: 0x232830,
        },

        // Continuous neatly-trimmed hedge behind the railing.
        HEDGE: {
            ENABLED: true,
            X: 8.2,
            WIDTH: 0.9,
            HEIGHT: 0.85,
            COLOR: 0x3e8e46,
        },

        // Raised veranda walkway in front of the classrooms.
        VERANDA: {
            ENABLED: true,
            INNER_X: 13.6,
            WIDTH: 3.0,
            HEIGHT: 0.35,
            COLOR: 0xd9d3c5,
            KERB_COLOR: 0xb5ae9e,
        },

        // Long continuous 2-3 storey school blocks. Modules butt together
        // (no gaps, no jitter) so each side reads as ONE building running to
        // the horizon; two floor-count variants alternate for rhythm.
        BUILDINGS: {
            ENABLED: true,
            INNER_X: 16.6,            // closest face, from track centre
            DEPTH: 9,                 // block width, away from the track
            LENGTH: 24,               // module length along the track
            FLOOR_HEIGHT: 3.4,
            VARIANTS: [
                { floors: 3 },
                { floors: 2 },
            ],
            WALL_COLOR: '#e8c761',    // warm yellow school wall
            WALL_SHADE: '#d3ae52',    // recessed/shadowed band
            WINDOW_COLOR: '#4d6f8c',
            WINDOW_GLASS: '#7d9db8',
            FRAME_COLOR: '#f4f1e8',
            TRIM_COLOR: '#8a2f2b',    // maroon architectural trim
            PLINTH_COLOR: '#c9c2b2',  // concrete base course
            DARK_COLOR: '#4a4f57',    // open corridor shadow
        },
    },

    // ========== SKY & CLOUDS ==========
    SKY: {
        COLOR: 0x87CEEB,              // bright cartoon sky
        // Vertical gradient "skybox". HORIZON must stay equal to
        // LIGHTING.FOG.color or the haze band will show a hard seam.
        GRADIENT: {
            ENABLED: true,
            TOP: '#4f9fd8',           // deeper blue overhead
            HORIZON: '#cfe6f5',       // pale haze down at the skyline
        },
        FOG_COLOR: 0xcfe6f5,          // == GRADIENT.HORIZON (seamless horizon)
        CLOUD_COUNT: 5,
        CLOUD_DRIFT: 0.4,             // u/s sideways drift
        CLOUD_SPREAD_X: 46,
        CLOUD_MIN_Y: 13,
        CLOUD_MAX_Y: 24,
        CLOUD_Z: -70,
        CLOUD_SIZE_MIN: 6,            // small, soft puffs (was 10-24: too big)
        CLOUD_SIZE_MAX: 12,
    },

    // ========== SCENERY BILLBOARDS ==========
    // The scenery renders in assets/scenery/ are drop-in billboards. Every
    // slot is optional: a missing file (or SCENERY.ENABLED = false) leaves the
    // procedural world exactly as it was, so an empty assets/ is unaffected.
    // Widths are DERIVED from each image's own aspect ratio (height is
    // authoritative), so no scenery art is ever stretched.
    SCENERY: {
        // OFF by default: the far end of the road is the procedural campus
        // dissolving into the sky-coloured fog, with the real gradient sky and
        // a few small clouds above it — no photo billboards, so nothing at the
        // horizon can read as a pasted/duplicated image. Set true to opt in to
        // the drop-in renders below (horizon + gate).
        ENABLED: false,

        // Distant backdrop, re-anchored to the camera every frame so it never
        // gets closer (same "infinite distance" trick as a skybox).
        // fog is disabled on it, otherwise FOG.far would wash it out entirely.
        HORIZON: {
            ENABLED: true,
            URL: 'assets/scenery/school-gate-avenue.png',
            HEIGHT: 74,               // world units tall
            MAX_WIDTH: 200,           // clamp for unexpectedly wide art
            Y: 25,                    // centre height
            DISTANCE: 200,            // metres ahead of the camera
            PARALLAX: 0.1,            // lateral drift vs camera x (0 = pinned)
            OPACITY: 1,
            // The render ships with its own sky baked in; at load time those
            // pixels are keyed out (cool blues + cool whites -> transparent)
            // so the real gradient sky and drifting clouds show through
            // behind the gate instead of a pasted rectangle. Warm whites
            // (marble) and yellows (buildings) are kept. SKYLINE is the image
            // fraction below which nothing is ever touched (road/ground).
            SKY_KEY: {
                ENABLED: true,
                SKYLINE: 0.62,
                FEATHER: 0.12,        // vertical fade band above the skyline
            },
        },

        // Landmarks the runner passes through. Each entry is either a
        // recycling ring (REPEAT: true, the default — COUNT billboards spaced
        // SPACING metres apart, looping back once they pass the camera) or a
        // one-shot (REPEAT: false — one billboard that scrolls past once and
        // never returns). PHASE offsets a landmark against the others so they
        // alternate instead of stacking.
        RECYCLE_BEHIND: 26,
        LANDMARKS: [
            {
                ID: 'gate',
                ENABLED: true,
                URL: 'assets/scenery/school-gate-arch.png',
                HEIGHT: 18,
                MAX_WIDTH: 34,
                Y: 8.6,               // feet of the arch sit just below ground
                COUNT: 2,
                SPACING: 110,         // metres between gates
                PHASE: 30,            // run STARTS by leaving through the gate
                REPEAT: false,        // one gate only — it must never come back
                SEGMENTS: 1,          // billboards per landmark
                SEGMENT_STEP: 0,
                OPACITY: 1,
            },
        ],
    },

    // ========== CAMERA ==========
    CAMERA: {
        FOV: 75,                      // Field of view
        NEAR: 0.1,                    // Near clipping plane
        FAR: 1000,                    // Far clipping plane
        POSITION_OFFSET: {            // Offset from player
            x: 0,
            y: 4.0,                   // Height above player (was 5 — too high)
            z: 9.2                    // Distance behind player (was 10)
        },
        LOOK_AHEAD_DISTANCE: 8,       // How far ahead to look
        FOLLOW_SMOOTHNESS: 0.1,       // Camera lerp factor (0.1 = smooth, 1 = instant)
        LATERAL_FOLLOW: 0.45,         // how much the camera follows lane changes (x)
        FOV_SPEED_KICK: 8,            // extra FOV degrees at max speed
        SHAKE_DURATION: 0.4,
        SHAKE_INTENSITY: 0.35,
    },

    // ========== LIGHTING ==========
    LIGHTING: {
        AMBIENT: {
            color: 0xffffff,          // White
            intensity: 0.6
        },
        DIRECTIONAL: {
            color: 0xffffff,
            intensity: 0.8,
            position: { x: -10, y: 20, z: 10 },
            castShadow: true
        },
        HEMISPHERE: {                 // sky/ground gradient
            skyColor: 0x87CEEB,       // Light blue
            groundColor: 0x654321,    // Brown
            intensity: 0.3
        },
        SHADOWS: {
            enabled: true,
            mapSize: 2048,            // Shadow quality (1024 for mobile)
            cameraSize: 20            // Shadow frustum size
        },
        FOG: {
            enabled: true,
            color: 0xcfe6f5,          // == SKY.GRADIENT.HORIZON (seamless)
            near: 55,                 // haze starts beyond the playfield...
            far: 265                  // ...and the campus dissolves into it
        }
    },

    // ========== AUDIO ==========
    AUDIO: {
        MASTER_VOLUME: 0.7,
        MUSIC_VOLUME: 0.4,
        SFX_VOLUME: 0.6,
        // Real files are used when present (via Howler.js); anything missing
        // falls back to Web-Audio synthesis. These are the drop-in paths.
        SOUNDS: {
            jump: 'assets/sounds/jump.mp3',
            collect: 'assets/sounds/collect.mp3',
            hit: 'assets/sounds/hit.mp3',
            teacherAlert: 'assets/sounds/teacher-alert.mp3',
            gameOver: 'assets/sounds/gameover.mp3',
            bgMusic: 'assets/sounds/bg-music.mp3',
            // synth-only extras (no drop-in files expected):
            ui: null,
            caught: null,
        },
        // Pinned CDN fallback for Howler.js (loaded only when mp3s exist)
        HOWLER_URL: 'https://cdn.jsdelivr.net/npm/howler@2.2.4/dist/howler.min.js',
        MUSIC_BPM: 132,               // chiptune loop tempo
        MUSIC_LOOKAHEAD: 0.12,        // scheduler lookahead (s)
        MUSIC_TIMER_MS: 30,           // scheduler tick (ms)
    },

    // ========== UI COLORS ==========
    COLORS: {
        PRIMARY: '#FFD700',           // Gold (grades, highlights)
        SECONDARY: '#4169E1',         // Royal Blue (school theme)
        DANGER: '#FF3B30',            // Red (teacher warning)
        SUCCESS: '#34C759',           // Green (good streak)
        TEXT_LIGHT: '#FFFFFF',
        TEXT_DARK: '#1A1A2E',
        BACKGROUND: '#1a1a2e',        // Dark blue-grey
        WARNING_OVERLAY: 'rgba(255, 0, 0, 0.3)' // Red tint
    },

    // ========== UI / HUD ==========
    UI: {
        // The three HUD dots counted your mistakes. They read as "health", so
        // they are off by default — the pressure cue is the red vignette.
        // Set true to bring them back; the 3-mistake rule never changes.
        SHOW_MISTAKE_PIPS: false,
        POPUP_POOL_SIZE: 8,
        TOAST_DURATION: 3200,
        START_SCREEN_SCROLL_SPEED: 8, // ambient world scroll behind the menu
    },

    // ========== INPUT ==========
    INPUT: {
        SWIPE_THRESHOLD: 24,          // px — responsive on phone + tablet
        SWIPE_COOLDOWN_MS: 120,       // prevent double-fires
        EDGE_DEAD_ZONE: 16,           // px — Android back-gesture safety
    },

    // ========== STORAGE (best scores) ==========
    STORAGE: {
        PREFIX: 'schoolrunner',
        BEST_SCORE_KEY: 'best.score',
        BEST_DISTANCE_KEY: 'best.distance',
        MUTED_KEY: 'muted',
    },

    // ========== PERFORMANCE ==========
    PERFORMANCE: {
        TARGET_FPS: 60,
        MOBILE_PIXEL_RATIO: 1.5,      // Limit on mobile
        DESKTOP_PIXEL_RATIO: 2,       // Limit on desktop
        ENABLE_SHADOWS_MOBILE: false, // Disable shadows on mobile
        MAX_DELTA: 0.1,               // clamp dt after tab switches (anti-tunnel)
        // Applied at boot when a touch device / low-end device is detected
        MOBILE_OVERRIDES: {
            visibleTiles: 14,
            obstaclePoolPerVariant: 3,
            paperPool: 10,
            decorDensity: 0.6,        // fraction of decor slots populated
            anisotropy: 4,
            campusBuildingVariants: 2,// drop the tallest block (1 less draw call)
            scenerySegments: 1,       // corridor = 1 billboard instead of a run
        },
        DESKTOP_ANISOTROPY: 8,
    },

    // ========== DEBUG ==========
    DEBUG: {
        SHOW_FPS: false,              // FPS counter
        SHOW_COLLISION_BOXES: false,  // Wireframe helpers
        GOD_MODE: false,              // No collisions
        SKIP_START_SCREEN: false,     // Jump straight into gameplay (testing)
        EXPOSE_TO_WINDOW: true,       // window.__game for console debugging
    }
};

// Export individual sections for easier imports
export const GROUND = CONFIG.GROUND;
export const LANES = CONFIG.LANES;
export const PLAYER = CONFIG.PLAYER;
export const TEACHER = CONFIG.TEACHER;
export const OBSTACLES = CONFIG.OBSTACLES;
export const GRADES = CONFIG.GRADES;
export const DECOR = CONFIG.DECOR;
export const CAMPUS = CONFIG.CAMPUS;
export const SKY = CONFIG.SKY;
export const SCENERY = CONFIG.SCENERY;
export const CAMERA = CONFIG.CAMERA;
export const LIGHTING = CONFIG.LIGHTING;
export const AUDIO = CONFIG.AUDIO;
export const COLORS = CONFIG.COLORS;
export const UI = CONFIG.UI;
export const INPUT = CONFIG.INPUT;
export const STORAGE = CONFIG.STORAGE;
export const PERFORMANCE = CONFIG.PERFORMANCE;
export const DEBUG = CONFIG.DEBUG;
